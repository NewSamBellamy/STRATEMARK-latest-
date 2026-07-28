/**
 * MarketIntelRepository — the transport-agnostic data contract.
 *
 * This is the seam between the UI and everything native. The renderer only ever
 * talks to this interface, so the exact same UI runs against:
 *   - MockRepository (in-memory fixtures) — today, the whole front-end phase
 *   - IpcRepository (Electron main ⇄ SQLite/Drizzle over IPC) — the real back end
 *   - (optionally) a cloud HTTP adapter later — no UI changes
 *
 * Swapping implementations is a one-line provider change (see the web app's
 * RepositoryProvider). Adding a method here is the single place the back end and
 * the UI agree on new capability.
 */
import type { CardType, DashboardTab, MaturityTier, MetricType, RefreshCadence } from './enums';
import type {
  Card,
  Company,
  CompanyMetric,
  DashboardContentFor,
  Deck,
  Market,
  ScopeDefinition,
  ViceClaim,
} from './types';

export interface CreateMarketInput {
  name: string;
  scopeDefinition: ScopeDefinition;
  refreshCadence: RefreshCadence;
}

/** A user's free-text request to research a new deck (the "New deck" screen). */
export interface DeckResearchBrief {
  prompt: string;
  region: string | null;
}

export interface ResearchProgress {
  message: string;
  /** 0..1 when known. */
  progress?: number;
  /** Log-line flavor for glass-box terminals: step (phase), find (discovery), warn. */
  kind?: 'step' | 'find' | 'warn';
}

export interface ResearchHandlers {
  onProgress?: (progress: ResearchProgress) => void;
  signal?: AbortSignal;
}

/** A grounded source. */
export interface Citation {
  title: string;
  url: string;
}

/** A focused "dig deeper" request on a company + a specific topic (spec: research-intuitive drill-down). */
export interface DeepDiveInput {
  companyId: string | null;
  companyName: string;
  /** The thing to expand on, e.g. "Annual Recurring Revenue", "the founding team". */
  topic: string;
  /** Optional extra framing (market name, current value, etc.). */
  context?: string | null;
}

export interface DeepDiveResult {
  markdown: string;
  citations: Citation[];
}

/** Grounded verification of a single claim (the "fact-check" action). */
export type FactCheckVerdict = 'supported' | 'contradicted' | 'unverified';

export interface FactCheckInput {
  /** The claim to verify, e.g. "Seedlip's ARR is $15M". */
  claim: string;
  companyName: string | null;
  context?: string | null;
}

export interface FactCheckResult {
  verdict: FactCheckVerdict;
  rationale: string;
  citations: Citation[];
}

/** A saved research report composed by the AI from deck/company evidence. */
export interface ReportRequest {
  kind: 'deck' | 'company';
  /** deckId when kind='deck'; companyId when kind='company'. */
  subjectId: string;
}

export interface Report {
  id: string;
  kind: 'deck' | 'company';
  subjectId: string;
  title: string;
  markdown: string;
  citations: Citation[];
  createdAt: string;
}

/** Targeted micro-research to fill a gap in an existing deck (intelligent empty states). */
export interface ExpandFocus {
  tier?: MaturityTier;
  cardType?: CardType;
}

/** A user's manual correction to a metric (human-in-the-loop override). */
export interface OverrideMetricInput {
  companyId: string;
  metricType: MetricType;
  /** Raw number (USD for money, count for users/employees, percent for share); null clears to Unknown. */
  value: number | null;
  /** The user's source note, e.g. "Confirmed by their VP Sales at dinner 07/2026". */
  note: string | null;
}

export interface CardFilter {
  cardType?: CardType;
  tier?: MaturityTier;
}

/** A card denormalized with everything the card face + reader needs in one shot. */
export interface CardWithCompany {
  card: Card;
  company: Company | null; // null for Barrier cards (not company-specific, spec §4)
  metrics: CompanyMetric[];
  viceClaims: ViceClaim[]; // populated only for Vice cards
}

export interface DashboardTabResult<T extends DashboardTab> {
  companyId: string;
  tab: T;
  content: DashboardContentFor<T>;
  lastRefreshedAt: string | null;
}

/** Emitted after a deck refresh so the UI can reconcile without a full refetch (spec §9). */
export interface DeckRefreshEvent {
  marketId: string;
  deckId: string;
  refreshedAt: string;
  addedCardIds: string[];
  updatedCardIds: string[];
  prunedCardIds: string[];
}

export type DeckRefreshListener = (event: DeckRefreshEvent) => void;
export type Unsubscribe = () => void;

export interface MarketIntelRepository {
  // Markets
  listMarkets(): Promise<Market[]>;
  getMarket(id: string): Promise<Market | null>;
  createMarket(input: CreateMarketInput): Promise<Market>;
  updateMarketCadence(id: string, cadence: RefreshCadence): Promise<Market>;

  // Decks
  getDeckByMarket(marketId: string): Promise<Deck | null>;
  /** Re-run the grounded-search research pass for the market scope (spec §9). */
  refreshDeck(marketId: string): Promise<Deck>;
  /**
   * Research a brand-new deck from a free-text brief (grounded pipeline).
   * Real implementations run Gemini; the demo implementation returns a sample.
   */
  createResearchedDeck(
    brief: DeckResearchBrief,
    handlers?: ResearchHandlers,
  ): Promise<{ market: Market; deck: Deck }>;

  // Cards
  listCards(deckId: string, filter?: CardFilter): Promise<CardWithCompany[]>;
  getCard(cardId: string): Promise<CardWithCompany | null>;

  // Company detail
  getCompany(companyId: string): Promise<Company | null>;
  getCompanyMetrics(companyId: string): Promise<CompanyMetric[]>;
  getViceClaims(cardId: string): Promise<ViceClaim[]>;

  // Dashboard (spec §8)
  getDashboardTab<T extends DashboardTab>(
    companyId: string,
    tab: T,
  ): Promise<DashboardTabResult<T> | null>;

  /** Grounded, sourced deep-dive on a specific topic — the "dig deeper" drill-down. */
  deepDive(input: DeepDiveInput): Promise<DeepDiveResult>;

  /** Grounded verification of a single claim — verdict + rationale + sources. */
  factCheck(input: FactCheckInput): Promise<FactCheckResult>;

  /** Fill a gap in a deck via targeted micro-research (e.g. hunt Seed-stage companies). */
  expandDeck(
    marketId: string,
    focus: ExpandFocus,
    handlers?: ResearchHandlers,
  ): Promise<{ added: number }>;

  /** Human-in-the-loop metric correction → confidence 'user_verified' → CMS re-tier. */
  overrideMetric(input: OverrideMetricInput): Promise<CompanyMetric>;

  /** Deck-level whitespace analysis (2×2 positioning thesis), grounded + cached. */
  getMarketOpportunity(marketId: string, force?: boolean): Promise<DeepDiveResult>;

  // Reports — AI-composed research artifacts, kept in an organized library.
  generateReport(request: ReportRequest, handlers?: ResearchHandlers): Promise<Report>;
  listReports(): Promise<Report[]>;
  getReport(id: string): Promise<Report | null>;

  // Live refresh stream (spec §9). No-op-unsubscribe implementations are valid.
  subscribeDeckRefresh(listener: DeckRefreshListener): Unsubscribe;
}
