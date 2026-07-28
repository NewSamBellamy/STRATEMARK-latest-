/**
 * The agentic research pipeline (a typed task graph, not literal LangGraph —
 * same idea, dependency-free and running in browser + Electron):
 *
 *   interpret ─▶ discover ─▶ enrich (fan-out, concurrency-gated) ─▶ score ─▶ assemble
 *                        └─▶ barriers ────────────────────────────────────┘
 *
 * "Every card is a search query": discovery is one grounded search; each company
 * is a grounded search (enrich) + a structuring pass; barriers are a grounded
 * search. Nothing factual comes from training data — only from grounded results,
 * and every figure is tagged verified / estimated / unknown with a citation.
 */
import {
  buildCmsInput,
  computeCms,
  type BrandTheme,
  type Card,
  type CardType,
  type CardWithCompany,
  type Company,
  type CompanyMetric,
  type Deck,
  type Market,
  type MaturityTier,
  type MetricType,
  type ViceClaim,
} from '@mi/contracts';
import {
  barrierOutSchema,
  discoveryOutSchema,
  enrichmentOutSchema,
  marketPlanOutSchema,
  tierReviewOutSchema,
  type EnrichmentOut,
} from './schemas';
import {
  GROUNDED_SYSTEM,
  STRUCTURE_SYSTEM,
  discoverPrompt,
  enrichPrompt,
  interpretMarketPrompt,
  structureDiscoveryPrompt,
  structureEnrichPrompt,
  structureMarketPrompt,
  tierReviewPrompt,
} from './prompts';
import type {
  Citation,
  CompanyCandidate,
  LlmClient,
  MarketPlan,
  OnResearchEvent,
  RunResearchOptions,
} from './types';
import { mapWithConcurrency, rootDomain, slugify, throwIfAborted } from './util';

export interface ResearchResult {
  market: Market;
  deck: Deck;
  cards: CardWithCompany[];
}

const uid = (prefix: string, slug: string): string =>
  `${prefix}_${slug}_${Math.random().toString(36).slice(2, 7)}`;

const now = (): string => new Date().toISOString();

/** Real, free logo source (faviconV2). The UI falls back to a monogram on error. */
export function faviconUrl(domain: string | null): string | null {
  if (!domain) return null;
  const site = encodeURIComponent(`https://${domain}`);
  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${site}&size=128`;
}

const DEFAULT_BRAND: BrandTheme = {
  primary: '#4f46e5',
  secondary: '#a5b4fc',
  accent: '#f59e0b',
  text: '#0f172a',
  background: '#ffffff',
  fontFamily: null,
  source: 'default',
};

function brandFrom(brand: EnrichmentOut['brand']): BrandTheme {
  if (!brand || !brand.primary || !brand.secondary || !brand.accent) {
    return DEFAULT_BRAND;
  }
  return {
    primary: brand.primary,
    secondary: brand.secondary,
    accent: brand.accent,
    text: '#0f172a',
    background: '#ffffff',
    fontFamily: null,
    source: 'scraped',
  };
}

function metricRows(
  enrich: EnrichmentOut,
  citations: Citation[],
  companyId: string,
): CompanyMetric[] {
  const rows: CompanyMetric[] = [];
  const source = (idx: number | null | undefined): string | null =>
    idx != null && citations[idx] ? citations[idx]!.url : null;
  for (const [type, m] of Object.entries(enrich.metrics ?? {})) {
    if (!m) continue;
    rows.push({
      id: uid('met', `${companyId}-${type}`),
      companyId,
      metricType: type as MetricType,
      value: m.value ?? null,
      confidence: m.confidence ?? 'unknown',
      source: source(m.sourceIndex),
      methodNote: m.method ?? null,
      capturedAt: now(),
    });
  }
  return rows;
}

interface EnrichedCompany {
  candidate: CompanyCandidate;
  company: Company;
  metrics: CompanyMetric[];
  enrich: EnrichmentOut;
  citations: Citation[];
}

async function interpret(
  client: LlmClient,
  brief: { prompt: string; region: string | null },
  signal?: AbortSignal,
): Promise<MarketPlan> {
  const grounded = await client.ground(interpretMarketPrompt(brief.prompt, brief.region), {
    system: GROUNDED_SYSTEM,
    signal,
  });
  const plan = await client.structure(structureMarketPrompt(grounded.text), marketPlanOutSchema, {
    system: STRUCTURE_SYSTEM,
    signal,
  });
  return {
    marketName: plan.marketName,
    vertical: plan.vertical,
    geography: plan.geography ?? brief.region,
    notes: plan.notes,
    searchThemes: plan.searchThemes,
  };
}

async function discover(
  client: LlmClient,
  plan: MarketPlan,
  target: number,
  signal?: AbortSignal,
): Promise<CompanyCandidate[]> {
  const grounded = await client.ground(discoverPrompt(plan, target), {
    system: GROUNDED_SYSTEM,
    signal,
  });
  const out = await client.structure(structureDiscoveryPrompt(grounded.text), discoveryOutSchema, {
    system: STRUCTURE_SYSTEM,
    signal,
  });
  // Dedupe by name; ensure at least a 'company' type.
  const seen = new Set<string>();
  const candidates: CompanyCandidate[] = [];
  for (const c of out.companies ?? []) {
    const key = c.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rawTypes = (c.cardTypes ?? []) as CardType[];
    const cardTypes = (rawTypes.length ? rawTypes : (['company'] as CardType[])).filter(
      (t) => t !== 'barrier',
    );
    candidates.push({
      name: c.name.trim(),
      domain: rootDomain(c.domain),
      descriptor: c.descriptor ?? '',
      cardTypes: cardTypes.length ? cardTypes : ['company'],
    });
  }
  return candidates;
}

async function enrichOne(
  client: LlmClient,
  candidate: CompanyCandidate,
  plan: MarketPlan,
  signal?: AbortSignal,
): Promise<EnrichedCompany> {
  const grounded = await client.ground(enrichPrompt(candidate, plan), {
    system: GROUNDED_SYSTEM,
    signal,
  });
  const enrich = await client.structure(
    structureEnrichPrompt(candidate, grounded.text, grounded.citations),
    enrichmentOutSchema,
    { system: STRUCTURE_SYSTEM, signal },
  );
  const slug = slugify(candidate.name);
  const companyId = uid('cmp', slug);
  const website = enrich.website ?? (candidate.domain ? `https://${candidate.domain}` : null);
  const domain = rootDomain(website) ?? candidate.domain;
  const company: Company = {
    id: companyId,
    name: candidate.name,
    oneLiner: enrich.oneLiner || candidate.descriptor,
    logoUrl: faviconUrl(domain),
    hqLocation: enrich.hqLocation ?? null,
    websiteUrl: website,
    brandTheme: brandFrom(enrich.brand ?? null),
  };
  return { candidate, company, metrics: metricRows(enrich, grounded.citations, companyId), enrich, citations: grounded.citations };
}

async function reviewTier(
  client: LlmClient,
  name: string,
  baseTier: MaturityTier,
  metrics: CompanyMetric[],
  signal?: AbortSignal,
): Promise<{ nudge: -1 | 0 | 1; reason: string | null }> {
  const evidence = metrics
    .map((m) => `${m.metricType}: ${m.value ?? 'unknown'} (${m.confidence})`)
    .join('; ');
  try {
    const out = await client.structure(
      tierReviewPrompt(name, baseTier, evidence),
      tierReviewOutSchema,
      { system: STRUCTURE_SYSTEM, signal },
    );
    return { nudge: out.nudge ?? 0, reason: out.reason ?? null };
  } catch {
    return { nudge: 0, reason: null };
  }
}

async function researchBarriers(
  client: LlmClient,
  plan: MarketPlan,
  deckId: string,
  signal?: AbortSignal,
): Promise<CardWithCompany[]> {
  const grounded = await client.ground(
    `Using Google Search, identify 2-4 structural barriers to entry for the market "${plan.marketName}" (${plan.vertical})${plan.geography ? ` in ${plan.geography}` : ''} — regulatory, capital intensity, network effects, brand trust, or supply chain. Ground each in what you find.`,
    { system: GROUNDED_SYSTEM, signal },
  );
  const out = await client.structure(
    `From the notes, output JSON { "barriers": [ { "title", "summary" } ] }.\n\nNOTES:\n${grounded.text}`,
    barrierOutSchema,
    { system: STRUCTURE_SYSTEM, signal },
  );
  return (out.barriers ?? []).map((b) => ({
    card: {
      id: uid('crd', `${slugify(b.title)}-barrier`),
      deckId,
      companyId: null,
      cardType: 'barrier' as CardType,
      title: b.title,
      summary: b.summary,
      tier: null,
      tierReason: null,
      createdAt: now(),
    },
    company: null,
    metrics: [],
    viceClaims: [],
  }));
}

/** Run the full deck-research pipeline. Streams progress via `onEvent`. */
export async function runDeckResearch(
  brief: { prompt: string; region: string | null },
  client: LlmClient,
  options: RunResearchOptions,
): Promise<ResearchResult> {
  const emit: OnResearchEvent = options.onEvent ?? (() => {});
  const signal = options.signal;
  const target = options.targetCompanies ?? 12;
  const concurrency = options.concurrency ?? 2;

  emit({ type: 'status', step: 'interpret', message: 'Understanding the market…' });
  const plan = await interpret(client, brief, signal);
  emit({ type: 'market', market: plan });

  emit({ type: 'status', step: 'discover', message: 'Discovering companies via grounded search…' });
  const candidates = await discover(client, plan, target, signal);
  emit({ type: 'candidates', candidates });

  const marketSlug = slugify(plan.marketName);
  const market: Market = {
    id: uid('mkt', marketSlug),
    name: plan.marketName,
    scopeDefinition: { vertical: plan.vertical, geography: plan.geography, notes: plan.notes },
    refreshCadence: 'weekly',
    createdAt: now(),
  };
  const deck: Deck = {
    id: uid('dck', marketSlug),
    marketId: market.id,
    createdAt: now(),
    lastRefreshedAt: now(),
  };

  // Enrich (fan-out, concurrency-gated). Progress reported per company.
  let done = 0;
  const enriched = await mapWithConcurrency(
    candidates,
    concurrency,
    async (candidate) => {
      throwIfAborted(signal);
      const result = await enrichOne(client, candidate, plan, signal);
      done += 1;
      emit({
        type: 'status',
        step: 'enrich',
        message: `Researched ${candidate.name} (${done}/${candidates.length})`,
        progress: done / candidates.length,
      });
      return result;
    },
    signal,
  );

  // Score: relative user values need the whole deck first.
  const deckUserValues = enriched
    .filter((e) => e.candidate.cardTypes.includes('company'))
    .flatMap((e) => e.metrics)
    .filter((m) => m.metricType === 'users' && m.confidence !== 'unknown' && m.value !== null)
    .map((m) => m.value as number);

  emit({ type: 'status', step: 'score', message: 'Scoring maturity tiers…' });
  const cards: CardWithCompany[] = [];
  for (const e of enriched) {
    let tier: MaturityTier | null = null;
    let tierReason: string | null = null;
    if (e.candidate.cardTypes.includes('company')) {
      const base = computeCms(buildCmsInput(e.metrics), { deckUserValues });
      if (base.finalTier != null) {
        const review = await reviewTier(client, e.company.name, base.finalTier, e.metrics, signal);
        const scored = computeCms(buildCmsInput(e.metrics), { deckUserValues }, { nudge: review.nudge });
        tier = scored.finalTier;
        tierReason = review.reason;
      }
    }
    for (const cardType of e.candidate.cardTypes) {
      const viceClaims: ViceClaim[] =
        cardType === 'vice'
          ? e.enrich.viceClaims
              .map((vc, i) => {
                const url = vc.sourceIndex != null ? e.citations[vc.sourceIndex]?.url : undefined;
                if (!url) return null; // grounding discipline: drop unsourced vice claims
                return {
                  id: uid('vcl', `${e.company.id}-${i}`),
                  cardId: '',
                  claimText: vc.text,
                  sourceUrl: url,
                  capturedAt: now(),
                };
              })
              .filter((x): x is ViceClaim => x !== null)
          : [];
      const card: Card = {
        id: uid('crd', `${slugify(e.company.name)}-${cardType}`),
        deckId: deck.id,
        companyId: e.company.id,
        cardType,
        title: null,
        summary: cardType === 'culture' ? e.enrich.cultureNote : null,
        tier: cardType === 'company' ? tier : null,
        tierReason: cardType === 'company' ? tierReason : null,
        createdAt: now(),
      };
      const stampedClaims = viceClaims.map((v) => ({ ...v, cardId: card.id }));
      const cwc: CardWithCompany = {
        card,
        company: e.company,
        metrics: e.metrics,
        viceClaims: stampedClaims,
      };
      cards.push(cwc);
      emit({ type: 'card', card: cwc });
    }
  }

  emit({ type: 'status', step: 'barriers', message: 'Identifying barriers to entry…' });
  try {
    const barriers = await researchBarriers(client, plan, deck.id, signal);
    for (const b of barriers) {
      cards.push(b);
      emit({ type: 'card', card: b });
    }
  } catch {
    emit({ type: 'warning', message: 'Could not research barriers to entry.' });
  }

  emit({ type: 'done', total: cards.length });
  return { market, deck, cards };
}
