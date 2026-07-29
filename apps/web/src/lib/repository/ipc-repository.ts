/**
 * IpcRepository — the drop-in back end for the Electron shell.
 *
 * It forwards every repository call to `window.mi` (exposed by the Electron
 * preload via contextBridge; see @mi/contracts `PreloadRepositoryApi`). Today,
 * in the plain web build, `window.mi` is undefined and the app uses
 * MockRepository instead — so this class is the wiring that makes the eventual
 * back end a zero-UI-change swap. It is intentionally a thin pass-through.
 */
import type {
  CardFilter,
  CardWithCompany,
  Company,
  CompanyMetric,
  CreateMarketInput,
  DashboardTab,
  DashboardTabResult,
  DeepDiveInput,
  DeepDiveResult,
  ExpandFocus,
  FactCheckInput,
  FactCheckResult,
  OverrideMetricInput,
  Report,
  ReportRequest,
  Deck,
  DeckRefreshListener,
  DeckResearchBrief,
  Market,
  MarketIntelRepository,
  PreloadRepositoryApi,
  RefreshCadence,
  ResearchHandlers,
  Unsubscribe,
  ViceClaim,
} from '@mi/contracts';

export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof window.mi !== 'undefined';
}

export class IpcRepository implements MarketIntelRepository {
  constructor(private readonly api: PreloadRepositoryApi) {}

  listMarkets(): Promise<Market[]> {
    return this.api.listMarkets();
  }
  getMarket(id: string): Promise<Market | null> {
    return this.api.getMarket(id);
  }
  createMarket(input: CreateMarketInput): Promise<Market> {
    return this.api.createMarket(input);
  }
  updateMarketCadence(id: string, cadence: RefreshCadence): Promise<Market> {
    return this.api.updateMarketCadence(id, cadence);
  }
  getDeckByMarket(marketId: string): Promise<Deck | null> {
    return this.api.getDeckByMarket(marketId);
  }
  refreshDeck(marketId: string): Promise<Deck> {
    return this.api.refreshDeck(marketId);
  }
  createResearchedDeck(
    brief: DeckResearchBrief,
    handlers?: ResearchHandlers,
  ): Promise<{ market: Market; deck: Deck }> {
    return this.api.createResearchedDeck(brief, handlers);
  }
  listCards(deckId: string, filter?: CardFilter): Promise<CardWithCompany[]> {
    return this.api.listCards(deckId, filter);
  }
  getCard(cardId: string): Promise<CardWithCompany | null> {
    return this.api.getCard(cardId);
  }
  getCompany(companyId: string): Promise<Company | null> {
    return this.api.getCompany(companyId);
  }
  getCompanyMetrics(companyId: string): Promise<CompanyMetric[]> {
    return this.api.getCompanyMetrics(companyId);
  }
  getViceClaims(cardId: string): Promise<ViceClaim[]> {
    return this.api.getViceClaims(cardId);
  }
  getDashboardTab<T extends DashboardTab>(
    companyId: string,
    tab: T,
    force?: boolean,
  ): Promise<DashboardTabResult<T> | null> {
    return this.api.getDashboardTab(companyId, tab, force);
  }
  deepDive(input: DeepDiveInput): Promise<DeepDiveResult> {
    return this.api.deepDive(input);
  }
  factCheck(input: FactCheckInput): Promise<FactCheckResult> {
    return this.api.factCheck(input);
  }
  expandDeck(marketId: string, focus: ExpandFocus): Promise<{ added: number }> {
    return this.api.expandDeck(marketId, focus);
  }
  overrideMetric(input: OverrideMetricInput): Promise<CompanyMetric> {
    return this.api.overrideMetric(input);
  }
  getMarketOpportunity(marketId: string, force?: boolean): Promise<DeepDiveResult> {
    return this.api.getMarketOpportunity(marketId, force);
  }
  generateReport(request: ReportRequest): Promise<Report> {
    return this.api.generateReport(request);
  }
  listReports(): Promise<Report[]> {
    return this.api.listReports();
  }
  getReport(id: string): Promise<Report | null> {
    return this.api.getReport(id);
  }
  subscribeDeckRefresh(listener: DeckRefreshListener): Unsubscribe {
    return this.api.onDeckRefresh(listener);
  }
}
