/**
 * Zod schemas — the runtime contract that mirrors the SQLite/Drizzle data model
 * (spec §10) and every per-tab dashboard payload. Every value crossing the
 * repository boundary is validated against these, so malformed back-end data is
 * caught, never silently rendered (see Constraints).
 */
import { z } from 'zod';
import {
  CARD_TYPES,
  CONFIDENCE_LEVELS,
  DASHBOARD_TABS,
  METRIC_TYPES,
  REFRESH_CADENCES,
} from './enums';

// Enum schemas -------------------------------------------------------------
export const cardTypeSchema = z.enum(CARD_TYPES);
export const metricTypeSchema = z.enum(METRIC_TYPES);
export const confidenceSchema = z.enum(CONFIDENCE_LEVELS);
export const refreshCadenceSchema = z.enum(REFRESH_CADENCES);
export const dashboardTabSchema = z.enum(DASHBOARD_TABS);
export const maturityTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
]);

// ISO-8601 timestamps travel as strings across the boundary (SQLite text / JSON).
const isoTimestamp = z.string().min(1);

// Core tables (spec §10) ---------------------------------------------------
export const scopeDefinitionSchema = z.object({
  vertical: z.string().min(1),
  geography: z.string().nullable(),
  notes: z.string().nullable(),
});

export const marketSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  scopeDefinition: scopeDefinitionSchema,
  refreshCadence: refreshCadenceSchema,
  createdAt: isoTimestamp,
});

export const deckSchema = z.object({
  id: z.string(),
  marketId: z.string(),
  createdAt: isoTimestamp,
  lastRefreshedAt: isoTimestamp.nullable(),
});

export const brandThemeSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  text: z.string(),
  background: z.string(),
  fontFamily: z.string().nullable(),
  source: z.enum(['scraped', 'llm', 'manual', 'default']),
});

export const companySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  oneLiner: z.string(),
  logoUrl: z.string().nullable(),
  hqLocation: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  brandTheme: brandThemeSchema.nullable(),
});

export const companyMetricSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  metricType: metricTypeSchema,
  value: z.number().nullable(), // null iff confidence === 'unknown'
  confidence: confidenceSchema,
  source: z.string().nullable(), // citation URL/text for verified figures
  methodNote: z.string().nullable(), // "how we got this number" for estimated figures
  capturedAt: isoTimestamp,
});

export const cardSchema = z.object({
  id: z.string(),
  deckId: z.string(),
  // Nullable: Barrier-to-Entry cards are not company-specific (spec §4).
  companyId: z.string().nullable(),
  cardType: cardTypeSchema,
  // Used for non-company cards (Barrier); company cards derive these from the company.
  title: z.string().nullable(),
  summary: z.string().nullable(),
  tier: maturityTierSchema.nullable(), // only Company cards carry a tier
  tierReason: z.string().nullable(), // LLM ±1 review reasoning (spec §6.3)
  createdAt: isoTimestamp,
});

export const viceClaimSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  claimText: z.string().min(1),
  sourceUrl: z.string().min(1), // REQUIRED — every Vice claim must be sourced (spec §4, §6.4)
  capturedAt: isoTimestamp,
});

// Dashboard per-tab content contracts (spec §8) ----------------------------
export const overviewContentSchema = z.object({
  markdown: z.string(),
});

export const liveIntelItemSchema = z.object({
  id: z.string(),
  source: z.enum(['news', 'x', 'reddit']),
  title: z.string(),
  url: z.string(),
  summary: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  publishedAt: isoTimestamp,
  stale: z.boolean(),
});
export const liveIntelContentSchema = z.object({
  items: z.array(liveIntelItemSchema),
  lastRefreshedAt: isoTimestamp.nullable(),
  cadence: refreshCadenceSchema,
});

export const orgNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  group: z.enum(['exec', 'ai', 'product', 'design', 'other']),
  parentId: z.string().nullable(),
});
export const teamOrgContentSchema = z.object({
  nodes: z.array(orgNodeSchema),
});

export const liveLandingContentSchema = z.object({
  url: z.string(),
  embeddable: z.boolean(),
  screenshotUrl: z.string().nullable(),
});

export const timePointSchema = z.object({ period: z.string(), value: z.number() });
export const capTableSliceSchema = z.object({ holder: z.string(), pct: z.number() });
export const metricsContentSchema = z.object({
  revenue: z.array(timePointSchema),
  users: z.array(timePointSchema),
  churn: z.array(timePointSchema),
  nps: z.array(timePointSchema),
  capTable: z.array(capTableSliceSchema),
});

export const boardMemberSchema = z.object({ name: z.string(), affiliation: z.string() });
export const missionGovernanceContentSchema = z.object({
  mission: z.string(),
  ethos: z.string(),
  governanceStructure: z.string(),
  board: z.array(boardMemberSchema),
  positives: z.array(z.string()),
  negatives: z.array(z.string()),
});

export const timelineEventSchema = z.object({
  date: z.string(),
  title: z.string(),
  detail: z.string(),
});
export const quoteSchema = z.object({ text: z.string(), attribution: z.string() });
export const historyContentSchema = z.object({
  founderStory: z.string(),
  timeline: z.array(timelineEventSchema),
  quotes: z.array(quoteSchema),
});

export const productSchema = z.object({
  name: z.string(),
  description: z.string(),
  status: z.enum(['live', 'beta', 'sunset']),
});
export const roadmapItemSchema = z.object({
  title: z.string(),
  horizon: z.enum(['now', 'next', 'later']),
  detail: z.string(),
});
export const productsRoadmapContentSchema = z.object({
  products: z.array(productSchema),
  roadmap: z.array(roadmapItemSchema),
});

/** Tab → content schema. Used to validate `dashboard_data.content_json` per tab. */
export const DASHBOARD_CONTENT_SCHEMAS = {
  overview: overviewContentSchema,
  live_intel: liveIntelContentSchema,
  team_org: teamOrgContentSchema,
  live_landing: liveLandingContentSchema,
  metrics: metricsContentSchema,
  mission_governance: missionGovernanceContentSchema,
  history: historyContentSchema,
  products_roadmap: productsRoadmapContentSchema,
} as const;

export const dashboardDataSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  tab: dashboardTabSchema,
  contentJson: z.unknown(),
  lastRefreshedAt: isoTimestamp.nullable(),
});
