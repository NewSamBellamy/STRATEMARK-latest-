/**
 * Prompt templates. The grounding discipline lives here: grounded steps must
 * rely ONLY on the attached Google-Search results, cite sources, and never
 * assert a figure from training data. Structuring steps convert that grounded
 * text into JSON and must mark anything unsupported as Unknown/Estimated.
 */
import { CARD_TYPE_LABELS, TIER_LABELS } from '@mi/contracts';
import type { CompanyCandidate, MarketPlan } from './types';
import type { Citation } from './types';

export const GROUNDED_SYSTEM =
  'You are a meticulous market-intelligence researcher. Use ONLY the Google Search results available to you via grounding — never state a company, figure, or claim from prior knowledge without a supporting search result. If the search results do not support something, say so explicitly rather than guessing. Prefer recent, primary sources (filings, company statements, reputable reporting). Always work from what the searches actually return.';

export const STRUCTURE_SYSTEM =
  'You convert researched notes into strict JSON. Output ONLY JSON — no prose, no code fences. Never invent values: if the notes do not support a field, use null and confidence "unknown". Use confidence "verified" only when a cited source states the figure directly, "estimated" when derived via a stated method, otherwise "unknown".';

export function interpretMarketPrompt(prompt: string, region: string | null): string {
  return [
    `A user wants to build a competitive-intelligence deck for this market:`,
    `"${prompt}"`,
    region ? `Region/geography scope: ${region}` : `No explicit region given.`,
    ``,
    `Search to understand this market, then describe it precisely: its canonical name, the specific vertical, the geographic scope, and 4-6 concrete search angles that would surface the real companies, infrastructure providers, distribution channels, and structural barriers in it. Ground everything in what you find.`,
  ].join('\n');
}

export function structureMarketPrompt(groundedText: string): string {
  return [
    `From these research notes, produce the market definition as JSON with keys: marketName, vertical, geography (or null), notes (or null), searchThemes (array of 4-6 short strings).`,
    ``,
    `NOTES:`,
    groundedText,
  ].join('\n');
}

export function discoverPrompt(plan: MarketPlan, target: number): string {
  return [
    `Market: ${plan.marketName} — ${plan.vertical}${plan.geography ? ` in ${plan.geography}` : ''}.`,
    `Search angles: ${plan.searchThemes.join('; ')}.`,
    ``,
    `Using Google Search, identify the REAL companies and entities in this market. Find roughly ${target} operating companies spanning maturity from tiny startups to dominant incumbents, PLUS a few infrastructure/tooling providers, a few distribution/channel players, and any notable culture or controversy (vice) angles. For each, note its name, its website root domain, a one-line descriptor, and which category it belongs to (${Object.values(CARD_TYPE_LABELS).join(', ')}). Only include entities you can actually find in search results.`,
    ``,
    `STRICT: include only actual operating companies/organizations. Government agencies, regulators, trade associations, events, and abstract concepts or debates are NOT companies — omit them entirely (do not force them into any category).`,
  ].join('\n');
}

export function structureDiscoveryPrompt(groundedText: string): string {
  return [
    `From these research notes, output JSON: { "companies": [ { "name", "domain" (root domain or null), "descriptor", "cardTypes" (array of: company, infrastructure, distribution, culture, vice) } ] }.`,
    `Deduplicate. Keep only real entities named in the notes.`,
    ``,
    `NOTES:`,
    groundedText,
  ].join('\n');
}

export function enrichPrompt(candidate: CompanyCandidate, plan: MarketPlan): string {
  return [
    `Research the company "${candidate.name}"${candidate.domain ? ` (${candidate.domain})` : ''} in the context of the market: ${plan.marketName}.`,
    ``,
    `Using Google Search, find, with sources:`,
    `- a one-line description of what it does`,
    `- HQ location (city, region/country)`,
    `- official website`,
    `- market share (as a % of the market, if reported)`,
    `- valuation (if private) OR market cap (if public) — whichever applies`,
    `- ARR / annual revenue`,
    `- number of users/customers`,
    `- number of employees`,
    candidate.cardTypes.includes('vice')
      ? `- any lawsuits, controversy, or integrity concerns (each MUST have a source)`
      : ``,
    candidate.cardTypes.includes('culture')
      ? `- notable positive community/culture signals (giving, non-profit ties)`
      : ``,
    `- the brand's primary colors (hex) from its website if visible`,
    ``,
    `Report each figure with its source. If a figure isn't disclosed, note whether it can be reasonably estimated (and how) or is simply unknown. Do not fabricate numbers.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function structureEnrichPrompt(candidate: CompanyCandidate, groundedText: string, citations: Citation[]): string {
  const sources = citations.map((c, i) => `[${i}] ${c.title} — ${c.url}`).join('\n') || '(none)';
  return [
    `Convert the research notes on "${candidate.name}" into JSON with this shape:`,
    `{ "oneLiner", "hqLocation"|null, "website"|null, "brand": {"primary","secondary","accent"}|null,`,
    `  "metrics": { "market_share"?, "valuation"?, "market_cap"?, "arr"?, "users"?, "employees"? } where each is`,
    `     { "value": number|null (raw number — dollars for money, count for users/employees, percent for share), "confidence": "verified"|"estimated"|"unknown", "sourceIndex": number|null (index into SOURCES), "method": string|null },`,
    `  "viceClaims": [ { "text", "sourceIndex": number|null } ], "cultureNote": string|null }`,
    ``,
    `Rules: use "verified" only if a SOURCE states the figure; "estimated" with a "method" note if derived; else "unknown" with value null. Every viceClaim MUST have a sourceIndex. Provide only valuation OR market_cap, not both.`,
    ``,
    `SOURCES:`,
    sources,
    ``,
    `NOTES:`,
    groundedText,
  ].join('\n');
}

export function tierReviewPrompt(name: string, baseTier: number, evidence: string): string {
  return [
    `A rules-based system scored "${name}" at maturity tier ${baseTier} (${TIER_LABELS[baseTier as 1]}) out of 8, where 1 is a pre-product sandbox and 8 is a category-defining titan.`,
    `Given the evidence below, decide whether to nudge the tier by -1, 0, or +1 (you may NOT move it further). Output JSON: { "nudge": -1|0|1, "reason": string|null }. Only nudge if the evidence clearly justifies it (e.g. share declining despite size), and give a one-sentence reason.`,
    ``,
    `EVIDENCE:`,
    evidence,
  ].join('\n');
}
