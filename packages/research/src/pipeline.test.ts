import { describe, expect, it, vi } from 'vitest';
import type { ZodType } from 'zod';
import type { LlmClient } from './types';
import { runDeckResearch } from './pipeline';
import { GeminiRepository, type ResearchStore, type RepoSnapshot } from './repository';

/**
 * A fake LLM that returns canned grounded text + citations and canned structured
 * objects (validated through the real Zod schema the pipeline passes in). Lets us
 * verify the entire orchestration — discovery, enrichment, citation threading,
 * CMS scoring, vice-claim sourcing, barrier cards — with zero network.
 */
function fakeClient(): LlmClient {
  const citations = [
    { title: 'techcrunch.com', url: 'https://tc.example/a' },
    { title: 'sec.gov', url: 'https://sec.example/b' },
  ];
  return {
    ground: vi.fn(async () => ({ text: 'grounded notes', citations, queries: ['q'] })),
    structure: (async (prompt: string, schema: ZodType<unknown>) => {
      let obj: unknown;
      if (prompt.includes('market definition')) {
        obj = { marketName: 'Test Market', vertical: 'Testing', geography: 'CA', notes: null, searchThemes: ['a', 'b'] };
      } else if (prompt.includes('"companies"')) {
        obj = {
          companies: [
            { name: 'Alpha Inc', domain: 'alpha.com', descriptor: 'big co', cardTypes: ['company'] },
            { name: 'Beta LLC', domain: 'beta.com', descriptor: 'risky co', cardTypes: ['company', 'vice'] },
            // The audit's defect, reproduced in shape: discovery hands back a
            // TOPIC dressed as a company, tagged only as a signal.
            {
              name: 'Alpha Inc / Safety / Governance Controversy Entity',
              domain: null,
              descriptor: 'governance concerns',
              cardTypes: ['vice'],
            },
          ],
        };
      } else if (prompt.includes('Convert the research notes on "Alpha Inc"')) {
        obj = {
          oneLiner: 'Alpha does things',
          hqLocation: 'SF, CA',
          website: 'https://alpha.com',
          brand: { primary: '#111', secondary: '#222', accent: '#333' },
          metrics: {
            market_cap: { value: 120_000_000_000, confidence: 'verified', sourceIndex: 1, method: null },
            arr: { value: 6_000_000_000, confidence: 'verified', sourceIndex: 1, method: null },
            employees: { value: 60_000, confidence: 'verified', sourceIndex: 0, method: null },
            users: { value: 40_000_000, confidence: 'estimated', sourceIndex: 0, method: 'app installs' },
            market_share: { value: 45, confidence: 'verified', sourceIndex: 0, method: null },
          },
          viceClaims: [],
          cultureNote: null,
        };
      } else if (prompt.includes('Convert the research notes on "Beta LLC"')) {
        obj = {
          oneLiner: 'Beta does risky things',
          hqLocation: 'LA, CA',
          website: 'https://beta.com',
          brand: null,
          metrics: {
            valuation: { value: 8_000_000, confidence: 'estimated', sourceIndex: 0, method: 'seed round' },
            arr: { value: 400_000, confidence: 'estimated', sourceIndex: 0, method: 'proxy' },
            employees: { value: 12, confidence: 'verified', sourceIndex: 0, method: null },
            users: { value: 1_000, confidence: 'estimated', sourceIndex: 0, method: 'followers' },
          },
          viceClaims: [
            { text: 'Sued in 2025', sourceIndex: 0 },
            { text: 'Unsourced rumor', sourceIndex: null }, // must be dropped
          ],
          cultureNote: null,
        };
      } else if (prompt.includes('"barriers"')) {
        obj = {
          barriers: [{ title: 'Capital intensity', summary: 'Expensive to enter.', sourceIndex: 0 }],
          insights: [{ title: 'Margins are shifting', summary: 'Compute costs falling fast.', sourceIndex: 1 }],
        };
      } else if (prompt.includes('"markdown"')) {
        obj = { markdown: '# Overview\n\n## What they do\nStuff.\n\n## Why it matters\nReasons.' };
      } else if (prompt.includes('"verdict"')) {
        obj = { verdict: 'supported', rationale: 'Multiple filings state this figure.' };
      } else if (prompt.includes('nudge')) {
        obj = { nudge: 0, reason: null };
      } else {
        obj = {};
      }
      return schema.parse(obj);
    }) as LlmClient['structure'],
  };
}

describe('runDeckResearch (full orchestration, fake LLM)', () => {
  it('produces company, vice, and barrier cards with grounded sources', async () => {
    const events: string[] = [];
    const result = await runDeckResearch({ prompt: 'test market', region: 'CA' }, fakeClient(), {
      apiKey: '',
      onEvent: (e) => events.push(e.type),
    });

    expect(result.market.name).toBe('Test Market');
    const companyCards = result.cards.filter((c) => c.card.cardType === 'company');
    expect(companyCards).toHaveLength(2);

    // Alpha should score as a top-tier titan; Beta near the bottom.
    const alpha = companyCards.find((c) => c.company?.name === 'Alpha Inc')!;
    const beta = companyCards.find((c) => c.company?.name === 'Beta LLC')!;
    expect(alpha.card.tier).toBeGreaterThanOrEqual(7);
    expect(beta.card.tier).toBeLessThanOrEqual(3);

    // Metrics carry citation URLs from grounding.
    const cap = alpha.metrics.find((m) => m.metricType === 'market_cap');
    expect(cap?.source).toBe('https://sec.example/b');

    // Logos resolved from the domain.
    expect(alpha.company?.logoUrl).toContain('faviconV2');

    // Vice card: sourced claim kept, unsourced claim dropped.
    const vice = result.cards.find((c) => c.card.cardType === 'vice')!;
    expect(vice.viceClaims).toHaveLength(1);
    expect(vice.viceClaims[0]!.sourceUrl).toBe('https://tc.example/a');

    // Barrier card is company-agnostic.
    const barrier = result.cards.find((c) => c.card.cardType === 'barrier')!;
    expect(barrier.company).toBeNull();
    expect(barrier.card.title).toBe('Capital intensity');

    // Insight card rides along on the same market-level pass, with its source.
    const insight = result.cards.find((c) => c.card.cardType === 'insight')!;
    expect(insight.company).toBeNull();
    expect(insight.card.citations[0]?.url).toBe('https://sec.example/b');
    expect(barrier.card.citations[0]?.url).toBe('https://tc.example/a');

    expect(events).toContain('market');
    expect(events).toContain('done');
  });

  it('refuses to mint a company from a topic, and warns instead of failing silently', async () => {
    const warnings: string[] = [];
    const result = await runDeckResearch({ prompt: 'test market', region: 'CA' }, fakeClient(), {
      apiKey: '',
      onEvent: (e) => {
        if (e.type === 'warning') warnings.push(e.message);
      },
    });

    // Audit Finding 1.2: this pseudo-entity used to become a card AND inherit a
    // real company's valuation/ARR/users as unsourced "verified" figures.
    const names = result.cards.map((c) => c.company?.name ?? c.card.title ?? '');
    expect(names.some((n) => /Controversy Entity/.test(n))).toBe(false);
    expect(warnings.join(' ')).toMatch(/topic rather than a company/i);
    expect(warnings.join(' ')).toMatch(/Controversy Entity/);
  });

  it('never lends a company figure to a signal card', async () => {
    const result = await runDeckResearch({ prompt: 'test market', region: 'CA' }, fakeClient(), {
      apiKey: '',
    });

    // Beta LLC is legitimately both a company and a vice facet. The company
    // card owns the numbers; the vice card owns the sourced claim. If both
    // carried metrics, one figure would appear twice under two provenance
    // stories — which is how a wrong number becomes credible.
    const betaCompany = result.cards.find(
      (c) => c.card.cardType === 'company' && c.company?.name === 'Beta LLC',
    )!;
    const betaVice = result.cards.find((c) => c.card.cardType === 'vice')!;
    expect(betaCompany.metrics.length).toBeGreaterThan(0);
    expect(betaVice.metrics).toEqual([]);
    expect(betaVice.viceClaims.length).toBeGreaterThan(0);
  });
});

describe('GeminiRepository (fake client + in-memory store)', () => {
  function memStore(): ResearchStore {
    let s: RepoSnapshot | null = null;
    return { read: () => s, write: (snap) => (s = snap) };
  }

  it('persists a researched deck and serves its cards + lazy dashboard tabs', async () => {
    const store = memStore();
    const repo = new GeminiRepository({ apiKey: 'x', client: fakeClient(), store });

    const { market, deck } = await repo.createResearchedDeck({ prompt: 'test', region: 'CA' });
    expect((await repo.listMarkets())[0]!.id).toBe(market.id);

    const cards = await repo.listCards(deck.id);
    expect(cards.length).toBeGreaterThan(0);

    const company = cards.find((c) => c.company)!.company!;
    const overview = await repo.getDashboardTab(company.id, 'overview');
    // metrics tab is built locally from stored figures (no fabricated series).
    const metrics = await repo.getDashboardTab(company.id, 'metrics');
    expect(overview?.tab).toBe('overview');
    expect(metrics?.tab).toBe('metrics');

    // A fresh repo backed by the same store rehydrates the deck (persistence).
    const repo2 = new GeminiRepository({ apiKey: 'x', client: fakeClient(), store });
    expect((await repo2.listMarkets()).length).toBe(1);
  });

  it('fact-checks a claim with a grounded verdict + citations', async () => {
    const repo = new GeminiRepository({ apiKey: 'x', client: fakeClient(), store: memStore() });
    const result = await repo.factCheck({ claim: 'Alpha Inc market cap is $120B', companyName: 'Alpha Inc' });
    expect(result.verdict).toBe('supported');
    expect(result.rationale).toContain('filings');
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it('generates a deck report from stored evidence and persists it in the library', async () => {
    const store = memStore();
    const repo = new GeminiRepository({ apiKey: 'x', client: fakeClient(), store });
    const { deck } = await repo.createResearchedDeck({ prompt: 'test', region: 'CA' });
    const report = await repo.generateReport({ kind: 'deck', subjectId: deck.id });
    expect(report.title).toContain('Market Report');
    expect(report.citations.length).toBeGreaterThan(0);
    expect((await repo.listReports())).toHaveLength(1);
    expect((await repo.getReport(report.id))?.id).toBe(report.id);
    // Survives a restart (persisted through the store).
    const repo2 = new GeminiRepository({ apiKey: 'x', client: fakeClient(), store });
    expect((await repo2.listReports())).toHaveLength(1);
  });
});
