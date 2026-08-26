/**
 * generateDeckBriefing — the overnight desk.
 *
 * Contract under test:
 *   1. A baked deck gets ONE grounded pass; updates keep only
 *      verification-grade citations and resolve tracked-company ids.
 *   2. An update whose only sources are junk domains is DROPPED (the same
 *      no-fabrication rule metrics live under).
 *   3. A still-forming deck is GATED: the method throws before any research
 *      call is spent.
 */
import { describe, expect, it, vi } from 'vitest';
import { GeminiRepository, type RepoSnapshot, type ResearchStore } from './repository';
import { briefingOutSchema } from './schemas';
import type { LlmClient } from './types';

function snapshot(opts?: { formingCard?: boolean }): RepoSnapshot {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    markets: [
      {
        id: 'mkt_1',
        name: 'Frontier AI',
        scopeDefinition: { vertical: 'AI', geography: 'Global', inclusions: [], exclusions: [] },
        refreshCadence: 'manual',
        createdAt: now,
      },
    ],
    decks: [{ id: 'deck_1', marketId: 'mkt_1', createdAt: now, lastRefreshedAt: now }],
    companies: [
      {
        id: 'cmp_1',
        name: 'OpenAI',
        oneLiner: 'Frontier AI research and deployment company.',
        websiteUrl: 'https://openai.com',
        logoUrl: null,
        hqLocation: 'San Francisco, CA',
        brandTheme: null,
      },
      {
        id: 'cmp_2',
        name: 'Anthropic',
        oneLiner: 'AI safety and research company.',
        websiteUrl: 'https://anthropic.com',
        logoUrl: null,
        hqLocation: 'San Francisco, CA',
        brandTheme: null,
      },
    ],
    metrics: [],
    cards: [
      {
        id: 'card_1',
        deckId: 'deck_1',
        companyId: 'cmp_1',
        cardType: 'company',
        title: null,
        summary: null,
        tier: 8,
        tierReason: null,
        citations: [],
        keyPoints: [],
        createdAt: now,
      },
      {
        id: 'card_2',
        deckId: 'deck_1',
        companyId: 'cmp_2',
        cardType: 'company',
        title: null,
        summary: null,
        tier: opts?.formingCard ? null : 7, // null → deck still forming
        tierReason: null,
        citations: [],
        keyPoints: [],
        createdAt: now,
      },
    ],
    viceClaims: [],
    dashboards: {},
    companyMarket: { cmp_1: 'Frontier AI', cmp_2: 'Frontier AI' },
    opportunity: {},
    reports: [],
    briefings: [],
    savedCards: [],
    researchJobs: [],
    threads: [],
  } as unknown as RepoSnapshot;
}

function memoryStore(initial: RepoSnapshot): ResearchStore {
  let data: RepoSnapshot | null = initial;
  return {
    read: () => data,
    write: (snap: RepoSnapshot) => {
      data = snap;
    },
  };
}

function repoWith(client: LlmClient, snap = snapshot()): GeminiRepository {
  return new GeminiRepository({ apiKey: 'k', store: memoryStore(snap), client });
}

describe('generateDeckBriefing — the overnight desk', () => {
  it('composes a briefing from one grounded pass, resolves company ids, keeps sourced updates', async () => {
    const ground = vi.fn().mockResolvedValue({
      text: 'desk notes',
      citations: [
        { title: 'Reuters', url: 'https://reuters.com/openai-raise' },
        { title: 'The Verge', url: 'https://theverge.com/anthropic-launch' },
      ],
      queries: [],
    });
    const structure = vi.fn().mockResolvedValue({
      headline: 'Capital and capability both moved today',
      updates: [
        {
          companyName: 'OpenAI',
          signal: 'high',
          oneLiner: 'OpenAI raised $10B at a $500B valuation.',
          detail: 'The round tightens the compute arms race.',
          publishedDate: '2026-08-26',
          sourceIndexes: [0],
        },
        {
          companyName: 'Anthropic Inc', // suffix noise — key-matching should still resolve
          signal: 'notable',
          oneLiner: 'Anthropic shipped a new agentic coding surface.',
          detail: 'Broadens the developer wedge.',
          publishedDate: '2026-08-26',
          sourceIndexes: [1],
        },
        {
          companyName: 'OpenAI',
          signal: 'high',
          oneLiner: 'A claim with no source index at all.',
          detail: 'Should be dropped.',
          publishedDate: null,
          sourceIndexes: [],
        },
      ],
      insights: ['Compute funding is consolidating around two poles.', '  '],
    });
    const repo = repoWith({ ground, structure } as unknown as LlmClient);

    const b = await repo.generateDeckBriefing('mkt_1');

    expect(ground).toHaveBeenCalledTimes(1); // ONE research pass for the whole deck
    expect(b.headline).toBe('Capital and capability both moved today');
    expect(b.updates).toHaveLength(2); // the sourceless "update" never happened
    expect(b.updates[0]!.signal).toBe('high'); // reveal order: high first
    expect(b.updates[0]!.companyId).toBe('cmp_1');
    expect(b.updates[1]!.companyId).toBe('cmp_2'); // "Anthropic Inc" → cmp_2
    expect(b.updates[0]!.citations[0]!.url).toContain('reuters.com');
    expect(b.insights).toEqual(['Compute funding is consolidating around two poles.']);

    // Persisted and listable, newest first.
    const listed = await repo.listDeckBriefings('mkt_1');
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe(b.id);
  });

  it('drops an update whose only citations are junk domains (no fabrication)', async () => {
    const ground = vi.fn().mockResolvedValue({
      text: 'desk notes',
      citations: [
        { title: 'fatjoe.com', url: 'https://fatjoe.com/seo-blog/openai-news' },
        { title: 'Reuters', url: 'https://reuters.com/anthropic-story' },
      ],
      queries: [],
    });
    const structure = vi.fn().mockResolvedValue({
      headline: 'Mixed day',
      updates: [
        {
          companyName: 'OpenAI',
          signal: 'high',
          oneLiner: 'Junk-sourced claim.',
          detail: 'x',
          publishedDate: null,
          sourceIndexes: [0], // junk-only → dropped
        },
        {
          companyName: 'Anthropic',
          signal: 'notable',
          oneLiner: 'Well-sourced development.',
          detail: 'y',
          publishedDate: null,
          sourceIndexes: [1],
        },
      ],
      insights: [],
    });
    const repo = repoWith({ ground, structure } as unknown as LlmClient);

    const b = await repo.generateDeckBriefing('mkt_1');
    expect(b.updates).toHaveLength(1);
    expect(b.updates[0]!.companyName).toBe('Anthropic');
  });

  it('GATES a still-forming deck before spending any research call', async () => {
    const ground = vi.fn();
    const structure = vi.fn();
    const repo = repoWith(
      { ground, structure } as unknown as LlmClient,
      snapshot({ formingCard: true }),
    );

    await expect(repo.generateDeckBriefing('mkt_1')).rejects.toThrow(/still forming \(1\/2/);
    expect(ground).not.toHaveBeenCalled();
    expect(structure).not.toHaveBeenCalled();
  });
});

describe('briefingOutSchema', () => {
  it('tolerates the model returning a bare updates array', () => {
    const parsed = briefingOutSchema.parse([
      { companyName: 'OpenAI', oneLiner: 'x', sourceIndexes: [0] },
    ]) as { headline: string; updates: Array<{ signal: string }>; insights: string[] };
    expect(parsed.updates).toHaveLength(1);
    expect(parsed.updates[0]!.signal).toBe('notable'); // default
    expect(parsed.headline).toBe('');
    expect(parsed.insights).toEqual([]);
  });
});
