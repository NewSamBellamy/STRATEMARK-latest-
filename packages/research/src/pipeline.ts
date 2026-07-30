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
  enforceMetricsProvenance,
  isEntityCardType,
} from '@mi/contracts';
import {
  marketCardsOutSchema,
  discoveryOutSchema,
  enrichmentOutSchema,
  marketPlanOutSchema,
  tierReviewBatchOutSchema,
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
  tierReviewBatchPrompt,
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
import { faviconUrl, resolveLogo } from './logos';
import { mapWithConcurrency, rootDomain, slugify, throwIfAborted } from './util';

export interface ResearchResult {
  market: Market;
  deck: Deck;
  cards: CardWithCompany[];
}

const uid = (prefix: string, slug: string): string =>
  `${prefix}_${slug}_${Math.random().toString(36).slice(2, 7)}`;

const now = (): string => new Date().toISOString();

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
  const cited = (idx: number | null | undefined): Citation[] =>
    idx != null && citations[idx] ? [citations[idx]!] : [];
  for (const [type, m] of Object.entries(enrich.metrics ?? {})) {
    if (!m) continue;
    const attached = cited(m.sourceIndex);
    rows.push({
      id: uid('met', `${companyId}-${type}`),
      companyId,
      metricType: type as MetricType,
      value: m.value ?? null,
      confidence: m.confidence ?? 'unknown',
      source: attached[0]?.url ?? null,
      citations: attached,
      methodNote: m.method ?? null,
      capturedAt: now(),
    });
  }
  // The model may claim "verified" while pointing at nothing. Provenance rules
  // decide the final confidence — evidence, not assertion. (Audit 2026-07-29:
  // 3 of 29 "verified" figures had no source at all.)
  return enforceMetricsProvenance(rows);
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
): Promise<{ candidates: CompanyCandidate[]; rejected: string[] }> {
  const grounded = await client.ground(discoverPrompt(plan, target), {
    system: GROUNDED_SYSTEM,
    signal,
  });
  const out = await client.structure(structureDiscoveryPrompt(grounded.text), discoveryOutSchema, {
    system: STRUCTURE_SYSTEM,
    signal,
  });
  // Dedupe by name, then enforce the entity rule below.
  const seen = new Set<string>();
  const candidates: CompanyCandidate[] = [];
  const rejected: string[] = [];
  for (const c of out.companies ?? []) {
    const key = c.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rawTypes = (c.cardTypes ?? []) as CardType[];
    // Barriers are market-level and researched in their own pass; they are never
    // a company facet.
    const cardTypes = rawTypes.filter((t) => t !== 'barrier');
    const domain = rootDomain(c.domain);

    // THE ENTITY RULE. Card types are *facets of a business*, not things in
    // their own right. A candidate tagged only with signals (vice / culture /
    // insight) is suspect: discovery may have handed us a topic dressed as a
    // company. Enriching one mints a pseudo-company that then inherits a real
    // company's figures with no evidence — the
    // "OpenAI / Safety / Governance Controversy Entity" defect in audit 1.2.
    //
    // But "controversial" and "not a company" are different things, and the
    // first version of this rule conflated them: on live data it threw away
    // Civitai, a real business whose newsworthy angle happens to be a
    // controversy. A resolvable domain is concrete evidence of an operating
    // entity, so treat a signal-only tag on something with a real web presence
    // as a MIS-TAG and promote it. With no domain and no entity facet, there is
    // nothing to stand a company card on — reject before it costs a grounded call.
    //
    // Either way a real company's own controversies still produce a Vice card:
    // those come from the company's own enrichment, where the evidence lives.
    let facets = cardTypes;
    if (facets.length > 0 && !facets.some(isEntityCardType)) {
      if (!domain) {
        rejected.push(c.name.trim());
        continue;
      }
      facets = ['company', ...facets];
    }

    candidates.push({
      name: c.name.trim(),
      domain,
      descriptor: c.descriptor ?? '',
      // An untyped candidate is assumed to be a plain company.
      cardTypes: facets.length ? facets : ['company'],
    });
  }
  return { candidates, rejected };
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

/**
 * Review the whole cohort's tiers in ONE call.
 *
 * Replaces one structure call per company (10 calls on a 10-company deck → 1).
 * That matters against a 15 RPM free-tier ceiling, and it makes the ranking
 * better: the model compares companies against each other rather than judging
 * each in isolation. Falls back to "no nudges" on any failure — the
 * deterministic base tier is always a valid answer.
 */
async function reviewTiersBatch(
  client: LlmClient,
  marketName: string,
  rows: { name: string; baseTier: MaturityTier; evidence: string }[],
  signal?: AbortSignal,
): Promise<Map<string, { nudge: -1 | 0 | 1; reason: string | null }>> {
  const out = new Map<string, { nudge: -1 | 0 | 1; reason: string | null }>();
  if (rows.length === 0) return out;
  try {
    const res = await client.structure(
      tierReviewBatchPrompt(marketName, rows),
      tierReviewBatchOutSchema,
      { system: STRUCTURE_SYSTEM, signal },
    );
    const byName = new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.name]));
    for (const r of res.reviews ?? []) {
      const key = byName.get((r.name ?? '').trim().toLowerCase());
      if (key) out.set(key, { nudge: r.nudge ?? 0, reason: r.reason ?? null });
    }
  } catch {
    /* keep the deterministic tiers — a failed review must never fail the deck */
  }
  return out;
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

/**
 * Market-level cards: structural barriers to entry AND the non-obvious dynamics
 * worth remembering (Insight cards). One grounded call feeds both, so the second
 * card type costs nothing extra against the per-minute free-tier ceiling.
 *
 * Neither type belongs to a company, so neither mints one — the same discipline
 * the entity rule now enforces in discovery.
 */
async function researchMarketCards(
  client: LlmClient,
  plan: MarketPlan,
  deckId: string,
  signal?: AbortSignal,
): Promise<CardWithCompany[]> {
  const where = plan.geography ? ` in ${plan.geography}` : '';
  const grounded = await client.ground(
    [
      `Using Google Search, research the market "${plan.marketName}" (${plan.vertical})${where} on two fronts:`,
      `1. BARRIERS — 2-4 structural barriers to entry: regulatory, capital intensity, network effects, brand trust, or supply chain.`,
      `2. INSIGHTS — 2-4 non-obvious dynamics from roughly the last 3-6 months that a smart operator would want to know: a shift underway, a counter-intuitive pattern, a mismatch between perception and reality.`,
      `Ground every point in what you actually find. Do not speculate.`,
    ].join('\n'),
    { system: GROUNDED_SYSTEM, signal },
  );
  const out = await client.structure(
    [
      `From the notes, output JSON { "barriers": [ { "title", "summary", "sourceIndex", "keyPoints" } ], "insights": [ { "title", "summary", "sourceIndex", "keyPoints" } ] }.`,
      `"sourceIndex" is the 0-based index of the source that supports the point, or null if none of the listed sources do.`,
      `"keyPoints" is 4-8 short entries (1-2 sentences each) carrying the substance behind the headline — concrete specifics drawn ONLY from the notes: figures, named companies, dates, mechanisms. No filler.`,
      ``,
      `SOURCES:`,
      grounded.citations.map((c, i) => `[${i}] ${c.title} — ${c.url}`).join('\n') || '(none)',
      ``,
      `NOTES:`,
      grounded.text,
    ].join('\n'),
    marketCardsOutSchema,
    { system: STRUCTURE_SYSTEM, signal },
  );

  const build = (
    claim: { title: string; summary: string; sourceIndex: number | null; keyPoints: string[] },
    cardType: 'barrier' | 'insight',
  ): CardWithCompany => {
    const cited = claim.sourceIndex != null ? grounded.citations[claim.sourceIndex] : undefined;
    return {
      card: {
        id: uid('crd', `${slugify(claim.title)}-${cardType}`),
        deckId,
        companyId: null,
        cardType,
        title: claim.title,
        summary: claim.summary,
        tier: null,
        tierReason: null,
        citations: cited ? [cited] : [],
        keyPoints: claim.keyPoints ?? [],
        createdAt: now(),
      },
      company: null,
      metrics: [],
      viceClaims: [],
    };
  };

  return [
    ...(out.barriers ?? []).map((b) => build(b, 'barrier')),
    ...(out.insights ?? []).map((i) => build(i, 'insight')),
  ];
}

/**
 * Targeted micro-research to fill a gap in an existing deck (intelligent empty
 * states): one focused grounded discovery + enrichment for a tier or card type.
 * Returns fully-assembled cards; the caller stamps deckId and ingests.
 */
export async function expandDeckResearch(args: {
  client: LlmClient;
  marketName: string;
  vertical: string;
  geography: string | null;
  focusPrompt: string;
  excludeNames: string[];
  deckId: string;
  deckUserValues: number[];
  target?: number;
  onEvent?: OnResearchEvent;
  signal?: AbortSignal;
}): Promise<CardWithCompany[]> {
  const emit: OnResearchEvent = args.onEvent ?? (() => {});
  const plan: MarketPlan = {
    marketName: args.marketName,
    vertical: args.vertical,
    geography: args.geography,
    notes: null,
    searchThemes: [args.focusPrompt],
  };
  emit({ type: 'status', step: 'discover', message: `Hunting: ${args.focusPrompt}` });
  const grounded = await args.client.ground(
    [
      `Market: ${plan.marketName} — ${plan.vertical}${plan.geography ? ` in ${plan.geography}` : ''}.`,
      `Using Google Search, find up to ${args.target ?? 3} REAL companies matching this focus: ${args.focusPrompt}.`,
      `Exclude these already-known companies: ${args.excludeNames.join(', ') || '(none)'}.`,
      `STRICT: only actual operating companies — no agencies, regulators, trade bodies, or concepts.`,
    ].join('\n'),
    { system: GROUNDED_SYSTEM, signal: args.signal },
  );
  const out = await args.client.structure(
    structureDiscoveryPrompt(grounded.text),
    discoveryOutSchema,
    { system: STRUCTURE_SYSTEM, signal: args.signal },
  );
  const known = new Set(args.excludeNames.map((n) => n.toLowerCase()));
  const candidates: CompanyCandidate[] = (out.companies ?? [])
    .filter((c) => !known.has(c.name.trim().toLowerCase()))
    .slice(0, args.target ?? 3)
    .map((c) => ({
      name: c.name.trim(),
      domain: rootDomain(c.domain),
      descriptor: c.descriptor ?? '',
      cardTypes: ['company'],
    }));
  emit({ type: 'candidates', candidates });

  const cards: CardWithCompany[] = [];
  for (const candidate of candidates) {
    throwIfAborted(args.signal);
    const e = await enrichOne(args.client, candidate, plan, args.signal);
    emit({ type: 'status', step: 'enrich', message: `Researched ${candidate.name}` });
    const base = computeCms(buildCmsInput(e.metrics), { deckUserValues: args.deckUserValues });
    let tier: MaturityTier | null = base.finalTier;
    let tierReason: string | null = null;
    if (base.finalTier != null) {
      const review = await reviewTier(args.client, e.company.name, base.finalTier, e.metrics, args.signal);
      tier = computeCms(
        buildCmsInput(e.metrics),
        { deckUserValues: args.deckUserValues },
        { nudge: review.nudge },
      ).finalTier;
      tierReason = review.reason;
    }
    const card: Card = {
      id: uid('crd', `${slugify(e.company.name)}-company`),
      deckId: args.deckId,
      companyId: e.company.id,
      cardType: 'company',
      title: null,
      summary: null,
      tier,
      tierReason,
      citations: [],
      keyPoints: [],
      createdAt: now(),
    };
    const cwc: CardWithCompany = { card, company: e.company, metrics: e.metrics, viceClaims: [] };
    cards.push(cwc);
    emit({ type: 'card', card: cwc });
  }
  return cards;
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
  const { candidates: discovered, rejected } = await discover(client, plan, target, signal);
  // Say so out loud when discovery hands back a topic dressed as a company. This
  // used to pass silently and mint a pseudo-company (audit Finding 1.2).
  if (rejected.length > 0) {
    emit({
      type: 'warning',
      message: `Skipped ${rejected.length} result${rejected.length === 1 ? '' : 's'} that ${rejected.length === 1 ? 'was' : 'were'} a topic rather than a company: ${rejected.join(', ')}.`,
    });
  }
  // Discovery routinely over-returns (measured: 17 candidates for a target of 8),
  // and every extra candidate costs a grounded enrichment call — the scarcest
  // free-tier resource. Cap to the target, keeping company cards first so the
  // deck's backbone survives the trim.
  const candidates =
    discovered.length > target
      ? [
          ...discovered.filter((c) => c.cardTypes.includes('company')),
          ...discovered.filter((c) => !c.cardTypes.includes('company')),
        ].slice(0, target)
      : discovered;
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
    .filter((e) => e.candidate.cardTypes.some(isEntityCardType))
    .flatMap((e) => e.metrics)
    .filter((m) => m.metricType === 'users' && m.confidence !== 'unknown' && m.value !== null)
    .map((m) => m.value as number);

  // Resolve logos ONCE here rather than probing per card at render time (audit
  // findings 2.2 / 3.1 / 3.3). Free, keyless, paced, and prefers vector art.
  emit({ type: 'status', step: 'score', message: 'Resolving company logos…' });
  await mapWithConcurrency(enriched, 2, async (e) => {
    const domain = rootDomain(e.company.websiteUrl) ?? e.candidate.domain;
    const logo = await resolveLogo({ name: e.company.name, domain }, { signal });
    if (logo.url) e.company.logoUrl = logo.url;
    return null;
  });

  emit({ type: 'status', step: 'score', message: 'Scoring maturity tiers…' });

  // Deterministic base tiers first, then ONE cohort-wide review pass.
  const baseTiers = new Map<string, MaturityTier>();
  const reviewRows: { name: string; baseTier: MaturityTier; evidence: string }[] = [];
  for (const e of enriched) {
    // Any company with an entity facet gets a maturity tier — a business whose
    // primary role is "infrastructure" still has a size and a stage.
    if (!e.candidate.cardTypes.some(isEntityCardType)) continue;
    const base = computeCms(buildCmsInput(e.metrics), { deckUserValues });
    if (base.finalTier == null) continue;
    baseTiers.set(e.company.id, base.finalTier);
    reviewRows.push({
      name: e.company.name,
      baseTier: base.finalTier,
      evidence: e.metrics
        .map((m) => `${m.metricType}: ${m.value ?? 'unknown'} (${m.confidence})`)
        .join('; '),
    });
  }
  const reviews = await reviewTiersBatch(client, plan.marketName, reviewRows, signal);

  const cards: CardWithCompany[] = [];
  for (const e of enriched) {
    let tier: MaturityTier | null = null;
    let tierReason: string | null = null;
    if (e.candidate.cardTypes.some(isEntityCardType) && baseTiers.has(e.company.id)) {
      const review = reviews.get(e.company.name) ?? { nudge: 0 as const, reason: null };
      const scored = computeCms(buildCmsInput(e.metrics), { deckUserValues }, { nudge: review.nudge });
      tier = scored.finalTier;
      tierReason = review.reason;
    }
    // Every sourced controversy this company actually has. Computed once, because
    // it decides whether a Vice card is worth minting at all.
    const sourcedViceClaims: ViceClaim[] = e.enrich.viceClaims
      .map((vc, i) => {
        const cite = vc.sourceIndex != null ? e.citations[vc.sourceIndex] : undefined;
        if (!cite?.url) return null; // grounding discipline: drop unsourced vice claims
        return {
          id: uid('vcl', `${e.company.id}-${i}`),
          cardId: '',
          claimText: vc.text,
          sourceUrl: cite.url,
          sourceTitle: cite.title || null,
          capturedAt: now(),
        };
      })
      .filter((x): x is ViceClaim => x !== null);
    const cultureNote = (e.enrich.cultureNote ?? '').trim();

    // ONE entity card per company, plus a signal card only where a signal exists.
    //
    // Discovery legitimately reports several roles for one business — OpenAI sells
    // models, rents inference, and distributes through a hyperscaler. But minting
    // a card per role printed the SAME four figures three times under three
    // headings, which is the duplication the entity rule was written to stop, and
    // it padded a 17-card deck to 47. The deck is "one card per company"; the
    // company's other roles are a property of that card, not extra cards.
    //
    // Signal facets are then emitted only when they carry content. A Vice card
    // with no sourced claim, or a Culture card with no note, is an empty promise —
    // measured on a live run: 10 of 10 companies were tagged culture or vice, and
    // every one of those cards came back with nothing in it.
    // Discovery is asked for exactly one role, so this is a tiebreak. Prefer the
    // more specific supplier roles: "company" is the label a model reaches for by
    // default, and letting it win would leave the Infrastructure and Distribution
    // views permanently empty.
    const primaryEntity =
      (['infrastructure', 'distribution', 'company'] as const).find((t) =>
        e.candidate.cardTypes.includes(t),
      ) ?? 'company';
    const emitted: CardType[] = [primaryEntity];
    if (e.candidate.cardTypes.includes('vice') && sourcedViceClaims.length > 0) emitted.push('vice');
    if (e.candidate.cardTypes.includes('culture') && cultureNote.length > 0) emitted.push('culture');

    for (const cardType of emitted) {
      const viceClaims: ViceClaim[] = cardType === 'vice' ? sourcedViceClaims : [];
      const card: Card = {
        id: uid('crd', `${slugify(e.company.name)}-${cardType}`),
        deckId: deck.id,
        companyId: e.company.id,
        cardType,
        title: null,
        summary: cardType === 'culture' ? cultureNote : null,
        tier: cardType === primaryEntity ? tier : null,
        tierReason: cardType === primaryEntity ? tierReason : null,
        citations: [],
        keyPoints: [],
        createdAt: now(),
      };
      const stampedClaims = viceClaims.map((v) => ({ ...v, cardId: card.id }));
      const cwc: CardWithCompany = {
        card,
        company: e.company,
        // Only a card that IS the business carries the business's figures. A
        // signal card states a sourced claim; lending it a valuation would show
        // the same number twice under two different provenance stories.
        metrics: isEntityCardType(cardType) ? e.metrics : [],
        viceClaims: stampedClaims,
      };
      cards.push(cwc);
      emit({ type: 'card', card: cwc });
    }
  }

  emit({ type: 'status', step: 'barriers', message: 'Identifying barriers and market insights…' });
  try {
    const marketCards = await researchMarketCards(client, plan, deck.id, signal);
    for (const b of marketCards) {
      cards.push(b);
      emit({ type: 'card', card: b });
    }
  } catch {
    emit({ type: 'warning', message: 'Could not research market-level barriers and insights.' });
  }

  emit({ type: 'done', total: cards.length });
  return { market, deck, cards };
}
