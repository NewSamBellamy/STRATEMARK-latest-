/**
 * SentinelRepository — Live Sentinel Cloud Run backend repository implementation.
 *
 * Connects the MarketIntelRepository interface to the Sentinel Cloud Run API.
 * Performs live network requests for markets, decks, cards, companies, metrics,
 * and vice claims when Cloud Engine is selected or when authenticated as a Pro user.
 */
import type {
  AskResearchInput,
  CardFilter,
  CardWithCompany,
  Company,
  CompanyMetric,
  CreateMarketInput,
  DashboardTab,
  DashboardTabResult,
  Deck,
  DeckRefreshListener,
  DeckResearchBrief,
  DeepDiveInput,
  DeepDiveResult,
  ExpandFocus,
  FactCheckInput,
  FactCheckResult,
  Market,
  MarketIntelRepository,
  OverrideMetricInput,
  RefreshCadence,
  Report,
  ReportRequest,
  ResearchHandlers,
  ResearchJob,
  ResearchThread,
  SavedCard,
  Unsubscribe,
  ViceClaim,
} from '@mi/contracts';
import { MockRepository } from '@mi/mocks';
import sampleSnapshot from '@/sample/frontier-snapshot.json';
import {
  getCloudDeck,
  getCloudDecks,
  runCloudResearchDeck,
} from '@/lib/sentinelApi';

export class SentinelRepository implements MarketIntelRepository {
  private fallbackRepo: MockRepository;
  private memoryMarkets = new Map<string, Market>();
  private memoryDecks = new Map<string, Deck>();
  private memoryCards = new Map<string, CardWithCompany[]>();

  constructor() {
    this.fallbackRepo = new MockRepository({
      latencyMs: 0,
      seedSnapshot: sampleSnapshot as any,
    });
  }

  async listMarkets(): Promise<Market[]> {
    try {
      const cloudDecks = await getCloudDecks();
      if (cloudDecks && cloudDecks.length > 0) {
        const remoteMarkets: Market[] = cloudDecks.map((d: any) => {
          const marketId = d.marketId || d.id || `mkt_${d.id}`;
          const market: Market = {
            id: marketId,
            name: d.marketName || d.title || d.prompt || 'Sentinel Cloud Market',
            scopeDefinition: {
              vertical: d.vertical || 'Competitive Market Intelligence',
              geography: d.region || d.geography || null,
              notes: d.notes || null,
            },
            refreshCadence: 'weekly',
            createdAt: d.createdAt || new Date().toISOString(),
          };
          (market as any).engine = 'cloud';
          this.memoryMarkets.set(marketId, market);
          return market;
        });

        // Combine with any locally created memory markets
        for (const localM of this.memoryMarkets.values()) {
          if (!remoteMarkets.some((rm) => rm.id === localM.id)) {
            remoteMarkets.push(localM);
          }
        }
        return remoteMarkets;
      }
    } catch (err) {
      console.warn('Failed to fetch remote markets from Sentinel Cloud:', err);
    }

    // Fallback to memory markets or local mock repository
    if (this.memoryMarkets.size > 0) {
      return Array.from(this.memoryMarkets.values());
    }
    return this.fallbackRepo.listMarkets();
  }

  async getMarket(id: string): Promise<Market | null> {
    if (this.memoryMarkets.has(id)) {
      return this.memoryMarkets.get(id)!;
    }
    const markets = await this.listMarkets();
    return markets.find((m) => m.id === id) || this.fallbackRepo.getMarket(id);
  }

  async createMarket(input: CreateMarketInput): Promise<Market> {
    const market: Market = {
      id: `mkt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: input.name,
      scopeDefinition: input.scopeDefinition,
      refreshCadence: input.refreshCadence,
      createdAt: new Date().toISOString(),
    };
    this.memoryMarkets.set(market.id, market);
    return market;
  }

  async updateMarketCadence(id: string, cadence: RefreshCadence): Promise<Market> {
    const market = await this.getMarket(id);
    if (market) {
      market.refreshCadence = cadence;
      this.memoryMarkets.set(id, market);
      return market;
    }
    return this.fallbackRepo.updateMarketCadence(id, cadence);
  }

  async getDeckByMarket(marketId: string): Promise<Deck | null> {
    if (this.memoryDecks.has(marketId)) {
      return this.memoryDecks.get(marketId)!;
    }

    try {
      const cloudPayload = await getCloudDeck(marketId);
      if (cloudPayload && cloudPayload.deck) {
        const d = cloudPayload.deck as any;
        const deck: Deck = {
          id: d.id || `dck_${marketId}`,
          marketId: d.marketId || marketId,
          createdAt: d.createdAt || new Date().toISOString(),
          lastRefreshedAt: d.lastRefreshedAt || new Date().toISOString(),
        };
        (deck as any).engine = 'cloud';
        this.memoryDecks.set(marketId, deck);

        // Process cards if returned in payload
        if (cloudPayload.cards && cloudPayload.cards.length > 0) {
          const cardsWithCompany = this.mapCloudCards(cloudPayload);
          this.memoryCards.set(deck.id, cardsWithCompany);
          this.memoryCards.set(marketId, cardsWithCompany);
        }
        return deck;
      }
    } catch (err) {
      console.warn(`Failed to fetch cloud deck for market ${marketId}:`, err);
    }

    return this.fallbackRepo.getDeckByMarket(marketId);
  }

  async refreshDeck(marketId: string): Promise<Deck> {
    const deck = await this.getDeckByMarket(marketId);
    if (deck) return deck;
    return this.fallbackRepo.refreshDeck(marketId);
  }

  async createResearchedDeck(
    brief: DeckResearchBrief,
    handlers?: ResearchHandlers,
  ): Promise<{ market: Market; deck: Deck }> {
    handlers?.onProgress?.({
      message: 'Connecting to Sentinel Cloud Agent…',
      stage: 'scope',
      kind: 'step',
    });

    const res = await runCloudResearchDeck(brief.prompt, brief.region);
    if (!res.ok) {
      throw new Error(res.error || 'Sentinel Cloud Agent failed to create research deck.');
    }

    const m = (res.market || res.result?.market || res.deck) as any;
    const marketId = m?.id || m?.marketId || `mkt_${Date.now().toString(36)}`;
    const marketName = m?.name || brief.prompt;

    const market: Market = {
      id: marketId,
      name: marketName,
      scopeDefinition: {
        vertical: m?.scopeDefinition?.vertical || brief.prompt,
        geography: brief.region || null,
        notes: null,
      },
      refreshCadence: 'weekly',
      createdAt: new Date().toISOString(),
    };
    (market as any).engine = 'cloud';

    const deckId = (res.deck as any)?.id || res.result?.deck?.id || `dck_${marketId}`;
    const deck: Deck = {
      id: deckId,
      marketId,
      createdAt: new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
    };
    (deck as any).engine = 'cloud';

    this.memoryMarkets.set(market.id, market);
    this.memoryDecks.set(market.id, deck);
    this.memoryDecks.set(deck.id, deck);

    if (res.cards && res.cards.length > 0) {
      const cardsWithCompany = this.mapCloudCards(res);
      this.memoryCards.set(deck.id, cardsWithCompany);
      this.memoryCards.set(market.id, cardsWithCompany);
    }

    handlers?.onProgress?.({
      message: 'Sentinel Cloud Agent deck created successfully.',
      stage: 'dashboard',
      progress: 1,
      kind: 'step',
    });

    return { market, deck };
  }

  async listCards(deckId: string, filter?: CardFilter): Promise<CardWithCompany[]> {
    if (this.memoryCards.has(deckId)) {
      let list = this.memoryCards.get(deckId)!;
      if (filter?.cardType) {
        list = list.filter((c) => c.card.cardType === filter.cardType);
      }
      return list;
    }

    try {
      const cloudPayload = await getCloudDeck(deckId);
      if (cloudPayload && cloudPayload.cards) {
        const cardsWithCompany = this.mapCloudCards(cloudPayload);
        this.memoryCards.set(deckId, cardsWithCompany);
        if (filter?.cardType) {
          return cardsWithCompany.filter((c) => c.card.cardType === filter.cardType);
        }
        return cardsWithCompany;
      }
    } catch (err) {
      console.warn(`Failed to fetch cloud cards for deck ${deckId}:`, err);
    }

    return this.fallbackRepo.listCards(deckId, filter);
  }

  async getCard(cardId: string): Promise<CardWithCompany | null> {
    for (const cardList of this.memoryCards.values()) {
      const match = cardList.find((c) => c.card.id === cardId);
      if (match) return match;
    }
    return this.fallbackRepo.getCard(cardId);
  }

  async listSavedCards(): Promise<CardWithCompany[]> {
    return this.fallbackRepo.listSavedCards();
  }

  async saveCard(cardId: string): Promise<SavedCard> {
    return this.fallbackRepo.saveCard(cardId);
  }

  async unsaveCard(cardId: string): Promise<void> {
    return this.fallbackRepo.unsaveCard(cardId);
  }

  async getCompany(companyId: string): Promise<Company | null> {
    for (const cardList of this.memoryCards.values()) {
      const match = cardList.find((c) => c.company?.id === companyId);
      if (match && match.company) return match.company;
    }
    return this.fallbackRepo.getCompany(companyId);
  }

  async getCompanyMetrics(companyId: string): Promise<CompanyMetric[]> {
    for (const cardList of this.memoryCards.values()) {
      const match = cardList.find((c) => c.company?.id === companyId);
      if (match) return match.metrics || [];
    }
    return this.fallbackRepo.getCompanyMetrics(companyId);
  }

  async getViceClaims(cardId: string): Promise<ViceClaim[]> {
    for (const cardList of this.memoryCards.values()) {
      const match = cardList.find((c) => c.card.id === cardId);
      if (match) return match.viceClaims || [];
    }
    return this.fallbackRepo.getViceClaims(cardId);
  }

  async getDashboardTab<T extends DashboardTab>(
    companyId: string,
    tab: T,
    force?: boolean,
  ): Promise<DashboardTabResult<T> | null> {
    return this.fallbackRepo.getDashboardTab(companyId, tab, force);
  }

  async deepDive(input: DeepDiveInput): Promise<DeepDiveResult> {
    return this.fallbackRepo.deepDive(input);
  }

  async factCheck(input: FactCheckInput): Promise<FactCheckResult> {
    return this.fallbackRepo.factCheck(input);
  }

  async expandDeck(marketId: string, focus: ExpandFocus): Promise<{ added: number }> {
    return this.fallbackRepo.expandDeck(marketId, focus);
  }

  async overrideMetric(input: OverrideMetricInput): Promise<CompanyMetric> {
    return this.fallbackRepo.overrideMetric(input);
  }

  async getMarketOpportunity(marketId: string, force?: boolean): Promise<DeepDiveResult> {
    return this.fallbackRepo.getMarketOpportunity(marketId, force);
  }

  async askResearch(input: AskResearchInput): Promise<ResearchThread> {
    return (this.fallbackRepo as any).askResearch(input);
  }

  async listResearchThreads(filter?: { deckId?: string; companyId?: string }): Promise<ResearchThread[]> {
    return (this.fallbackRepo as any).listResearchThreads(filter);
  }

  async getResearchThread(id: string): Promise<ResearchThread | null> {
    return (this.fallbackRepo as any).getResearchThread(id);
  }

  async saveThreadAsReport(threadId: string, focus?: string | null): Promise<Report> {
    return (this.fallbackRepo as any).saveThreadAsReport(threadId, focus);
  }

  async listResearchJobs(): Promise<ResearchJob[]> {
    return (this.fallbackRepo as any).listResearchJobs();
  }

  async getResearchJob(id: string): Promise<ResearchJob | null> {
    return (this.fallbackRepo as any).getResearchJob(id);
  }

  async cancelResearchJob(id: string): Promise<ResearchJob | null> {
    return (this.fallbackRepo as any).cancelResearchJob(id);
  }

  async resumeResearchJob(id: string): Promise<ResearchJob | null> {
    return (this.fallbackRepo as any).resumeResearchJob(id);
  }

  async generateReport(request: ReportRequest): Promise<Report> {
    return this.fallbackRepo.generateReport(request);
  }

  async listReports(): Promise<Report[]> {
    return this.fallbackRepo.listReports();
  }

  async getReport(id: string): Promise<Report | null> {
    return this.fallbackRepo.getReport(id);
  }

  subscribeDeckRefresh(_listener: DeckRefreshListener): Unsubscribe {
    return () => {};
  }

  private mapCloudCards(payload: any): CardWithCompany[] {
    const rawCards = payload.cards || payload.result?.cards || [];
    const rawCompanies = payload.companies || [];
    const rawMetrics = payload.metrics || [];
    const rawViceClaims = payload.viceClaims || [];

    const companyMap = new Map<string, Company>();
    for (const comp of rawCompanies) {
      if (comp.id) {
        companyMap.set(comp.id, {
          id: comp.id,
          name: comp.name || 'Company',
          oneLiner: comp.oneLiner || comp.descriptor || '',
          websiteUrl: comp.websiteUrl || `https://${comp.domain || 'example.com'}`,
          logoUrl: comp.logoUrl || null,
          hqLocation: comp.hqLocation || null,
          brandTheme: comp.brandTheme || {
            primary: '#0F766E',
            secondary: '#14B8A6',
            accent: '#14B8A6',
            text: '#0F172A',
            background: '#F8FAFC',
            fontFamily: null,
            source: 'default',
          },
        });
      }
    }

    return rawCards.map((c: any) => {
      const companyId = c.companyId || `comp_${c.id}`;
      let company = companyMap.get(companyId);
      if (!company) {
        company = {
          id: companyId,
          name: c.companyName || c.title || 'Target Company',
          oneLiner: c.summary || c.descriptor || '',
          websiteUrl: c.websiteUrl || 'https://example.com',
          logoUrl: c.logoUrl || null,
          hqLocation: c.hqLocation || null,
          brandTheme: {
            primary: '#0F766E',
            secondary: '#14B8A6',
            accent: '#14B8A6',
            text: '#0F172A',
            background: '#F8FAFC',
            fontFamily: null,
            source: 'default',
          },
        };
      }

      const card = {
        id: c.id,
        deckId: c.deckId || payload.deck?.id || 'dck_cloud',
        companyId: company.id,
        cardType: c.cardType || 'company',
        title: c.title || company.name,
        summary: c.summary || company.oneLiner,
        tier: c.tier ?? null,
        tierReason: c.tierReason || null,
        citations: c.citations || [],
        createdAt: c.createdAt || new Date().toISOString(),
        engine: 'cloud', // Visual distinction flag
      };

      const companyObj = company;
      const metrics = rawMetrics.filter((m: any) => m.companyId === companyObj.id);
      const viceClaims = rawViceClaims.filter((vc: any) => vc.cardId === c.id || vc.companyId === companyObj.id);

      return {
        card,
        company: companyObj,
        metrics,
        viceClaims,
      };
    });
  }
}
