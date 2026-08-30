/**
 * SentinelRepository — Live Sentinel Cloud Run backend repository implementation.
 *
 * Connects the MarketIntelRepository interface to the Sentinel Cloud Run API.
 * Performs live network requests for markets, decks, cards, companies, metrics,
 * and vice claims when Cloud Engine is selected or when authenticated as a Pro user.
 */
import type {
  AskResearchInput,
  Card,
  CardFilter,
  CardWithCompany,
  Citation,
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
import { MockRepository, type SeedSnapshot } from '@mi/mocks';
import sampleSnapshot from '@/sample/frontier-snapshot.json';

/** A Market/Deck object that optionally carries a runtime `engine` tag. */
interface CloudTagged {
  engine?: string;
}
type CloudMarket = Market & CloudTagged;
type CloudDeck = Deck & CloudTagged;

/** Shape of a raw record returned by the Sentinel Cloud API for a market or deck. */
type CloudRecord = Record<string, unknown>;

/** Payload shape passed to mapCloudCards — the union of all callers' shapes. */
interface CloudCardPayload {
  cards?: CloudRecord[];
  result?: { cards?: CloudRecord[] };
  deck?: CloudRecord;
  companies?: CloudRecord[];
  metrics?: CloudRecord[];
  viceClaims?: CloudRecord[];
}
import {
  deleteCloudDeck,
  getCloudDeck,
  getCloudDecks,
  getCloudMarket,
  getCloudMarkets,
  runCloudResearchDeck,
  askCloudResearch,
  expandCloudDeck,
  saveCloudCard,
  unsaveCloudCard,
  listCloudSavedCards,
  type CloudResearchDeckResponse,
} from '@/lib/sentinelApi';

export class SentinelRepository implements MarketIntelRepository {
  private fallbackRepo: MockRepository;
  private memoryMarkets = new Map<string, Market>();
  private memoryDecks = new Map<string, Deck>();
  private memoryCards = new Map<string, CardWithCompany[]>();

  constructor() {
    this.fallbackRepo = new MockRepository({
      latencyMs: 0,
      seedSnapshot: sampleSnapshot as unknown as SeedSnapshot,
    });
  }

  async listMarkets(): Promise<Market[]> {
    try {
      const [cloudDecks, cloudMarkets] = await Promise.all([
        getCloudDecks(),
        getCloudMarkets(),
      ]);
      const marketList = cloudMarkets.length > 0 ? cloudMarkets : cloudDecks;
      if (marketList && marketList.length > 0) {
        const remoteMarkets: Market[] = marketList.map((d: CloudRecord) => {
          const marketId = String(d.marketId || d.id || `mkt_${String(d.id)}`);
          const market: CloudMarket = {
            id: marketId,
            name: String(d.marketName || d.name || d.title || d.prompt || 'Sentinel Cloud Market'),
            scopeDefinition: {
              vertical: String(d.vertical || 'Competitive Market Intelligence'),
              geography: (d.region || d.geography || null) as string | null,
              notes: (d.notes || null) as string | null,
            },
            refreshCadence: 'weekly',
            createdAt: String(d.createdAt || new Date().toISOString()),
            engine: 'cloud',
          };
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
    try {
      const remote = await getCloudMarket(id);
      if (remote) {
        const market: CloudMarket = {
          id: (remote.id || remote.marketId || id) as string,
          name: (remote.name || remote.marketName || 'Sentinel Cloud Market') as string,
          scopeDefinition: {
            vertical: (remote.vertical || 'Competitive Market Intelligence') as string,
            geography: (remote.region || remote.geography || null) as string | null,
            notes: (remote.notes || null) as string | null,
          },
          refreshCadence: 'weekly',
          createdAt: (remote.createdAt || new Date().toISOString()) as string,
          engine: 'cloud',
        };
        this.memoryMarkets.set(id, market);
        return market;
      }
    } catch {
      /* ignore */
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

  async deleteMarket(id: string): Promise<boolean> {
    this.memoryMarkets.delete(id);
    const deck = this.memoryDecks.get(id);
    if (deck) {
      this.memoryDecks.delete(id);
      this.memoryDecks.delete(deck.id);
      this.memoryCards.delete(deck.id);
      this.memoryCards.delete(id);
      await deleteCloudDeck(deck.id);
    } else {
      await deleteCloudDeck(id);
    }
    await this.fallbackRepo.deleteMarket?.(id);
    return true;
  }

  async deleteDeck(deckId: string): Promise<boolean> {
    this.memoryDecks.delete(deckId);
    this.memoryCards.delete(deckId);
    for (const [mktId, m] of this.memoryMarkets.entries()) {
      if (m.id === deckId) this.memoryMarkets.delete(mktId);
    }
    const res = await deleteCloudDeck(deckId);
    await this.fallbackRepo.deleteDeck?.(deckId);
    return res;
  }

  async getDeckByMarket(marketId: string): Promise<Deck | null> {
    if (this.memoryDecks.has(marketId)) {
      return this.memoryDecks.get(marketId)!;
    }

    try {
      const cloudPayload = await getCloudDeck(marketId);
      if (cloudPayload && cloudPayload.deck) {
        const d: CloudRecord = cloudPayload.deck;
        const deck: CloudDeck = {
          id: String(d.id || `dck_${marketId}`),
          marketId: String(d.marketId || marketId),
          createdAt: String(d.createdAt || new Date().toISOString()),
          lastRefreshedAt: String(d.lastRefreshedAt || new Date().toISOString()),
          engine: 'cloud',
        };
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

    const rawM = res.market ?? res.result?.market ?? res.deck;
    const m: CloudRecord = (rawM as CloudRecord | undefined) ?? {};
    const marketId = String(m.id || m.marketId || `mkt_${Date.now().toString(36)}`);
    const marketName = String(m.name || brief.prompt);
    const scopeDef = m.scopeDefinition as CloudRecord | undefined;

    const market: CloudMarket = {
      id: marketId,
      name: marketName,
      scopeDefinition: {
        vertical: String(scopeDef?.vertical || brief.prompt),
        geography: brief.region || null,
        notes: null,
      },
      refreshCadence: 'weekly',
      createdAt: new Date().toISOString(),
      engine: 'cloud',
    };

    const deckRecord: CloudRecord = (res.deck as CloudRecord | undefined) ?? {};
    const deckId = String(deckRecord.id || res.result?.deck?.id || `dck_${marketId}`);
    const deck: CloudDeck = {
      id: deckId,
      marketId,
      createdAt: new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
      engine: 'cloud',
    };

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
    try {
      const cloudSaved = await listCloudSavedCards();
      if (cloudSaved && cloudSaved.length > 0) {
        return this.mapCloudCards({ cards: cloudSaved });
      }
    } catch {
      /* fallback */
    }
    return this.fallbackRepo.listSavedCards();
  }

  async saveCard(cardId: string): Promise<SavedCard> {
    try {
      await saveCloudCard(cardId);
    } catch {
      /* ignore */
    }
    return this.fallbackRepo.saveCard(cardId);
  }

  async unsaveCard(cardId: string): Promise<void> {
    try {
      await unsaveCloudCard(cardId);
    } catch {
      /* ignore */
    }
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
    try {
      const res = await expandCloudDeck(marketId, focus);
      if (res && typeof res.added === 'number') return res;
    } catch {
      /* fallback to local mock repository */
    }
    return this.fallbackRepo.expandDeck(marketId, focus);
  }

  async overrideMetric(input: OverrideMetricInput): Promise<CompanyMetric> {
    return this.fallbackRepo.overrideMetric(input);
  }

  async getMarketOpportunity(marketId: string, force?: boolean): Promise<DeepDiveResult> {
    return this.fallbackRepo.getMarketOpportunity(marketId, force);
  }

  async askResearch(input: AskResearchInput): Promise<ResearchThread> {
    try {
      const res = await askCloudResearch(input);
      if (res && res.id && Array.isArray(res.messages)) {
        return res as unknown as ResearchThread;
      }
    } catch {
      /* fallback to local mock repository */
    }
    return (this.fallbackRepo as MarketIntelRepository).askResearch!(input);
  }

  async listResearchThreads(filter?: { deckId?: string; companyId?: string }): Promise<ResearchThread[]> {
    return (this.fallbackRepo as MarketIntelRepository).listResearchThreads!(filter);
  }

  async getResearchThread(id: string): Promise<ResearchThread | null> {
    return (this.fallbackRepo as MarketIntelRepository).getResearchThread!(id);
  }

  async saveThreadAsReport(threadId: string, focus?: string | null): Promise<Report> {
    return (this.fallbackRepo as MarketIntelRepository).saveThreadAsReport!(threadId, focus);
  }

  async listResearchJobs(): Promise<ResearchJob[]> {
    return (this.fallbackRepo as MarketIntelRepository).listResearchJobs!();
  }

  async getResearchJob(id: string): Promise<ResearchJob | null> {
    return (this.fallbackRepo as MarketIntelRepository).getResearchJob!(id);
  }

  async cancelResearchJob(id: string): Promise<ResearchJob | null> {
    return (this.fallbackRepo as MarketIntelRepository).cancelResearchJob!(id);
  }

  async resumeResearchJob(id: string): Promise<ResearchJob | null> {
    return (this.fallbackRepo as MarketIntelRepository).resumeResearchJob!(id);
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

  cacheCloudDeckResponse(res: CloudResearchDeckResponse): void {
    const rawM = res.market ?? res.result?.market ?? res.deck;
    const m: CloudRecord = (rawM as CloudRecord | undefined) ?? {};
    const marketId = String(m.id || m.marketId || `mkt_${Date.now().toString(36)}`);
    const marketName = String(m.name || 'Sentinel Cloud Market');
    const scopeDef = m.scopeDefinition as CloudRecord | undefined;

    const market: CloudMarket = {
      id: marketId,
      name: marketName,
      scopeDefinition: {
        vertical: String(scopeDef?.vertical || 'Competitive Market Intelligence'),
        geography: (m.region || m.geography || null) as string | null,
        notes: null,
      },
      refreshCadence: 'weekly',
      createdAt: new Date().toISOString(),
      engine: 'cloud',
    };

    const deckRecord: CloudRecord = (res.deck as CloudRecord | undefined) ?? {};
    const deckId = String(deckRecord.id || res.result?.deck?.id || `dck_${marketId}`);
    const deck: CloudDeck = {
      id: deckId,
      marketId,
      createdAt: new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
      engine: 'cloud',
    };

    this.memoryMarkets.set(market.id, market);
    this.memoryDecks.set(market.id, deck);
    this.memoryDecks.set(deck.id, deck);

    if (res.cards && res.cards.length > 0) {
      const cardsWithCompany = this.mapCloudCards(res);
      this.memoryCards.set(deck.id, cardsWithCompany);
      this.memoryCards.set(market.id, cardsWithCompany);
    }
  }

  private mapCloudCards(payload: CloudCardPayload): CardWithCompany[] {
    const rawCards: Array<Record<string, unknown>> =
      (payload.cards as Array<Record<string, unknown>> | undefined) ||
      (payload.result?.cards as Array<Record<string, unknown>> | undefined) ||
      [];
    const rawCompanies: CloudRecord[] = payload.companies || [];
    const rawMetrics: CloudRecord[] = payload.metrics || [];
    const rawViceClaims: CloudRecord[] = payload.viceClaims || [];

    const companyMap = new Map<string, Company>();
    for (const comp of rawCompanies) {
      if (comp.id) {
        const compId = String(comp.id);
        companyMap.set(compId, {
          id: compId,
          name: String(comp.name || 'Company'),
          oneLiner: String(comp.oneLiner || comp.descriptor || ''),
          websiteUrl: String(comp.websiteUrl || `https://${String(comp.domain || 'example.com')}`),
          logoUrl: (comp.logoUrl || null) as string | null,
          hqLocation: (comp.hqLocation || null) as string | null,
          brandTheme: (comp.brandTheme as Company['brandTheme']) || {
            primary: '#0F766E',
            secondary: '#14B8A6',
            accent: '#14B8A6',
            text: '#0F172A',
            background: '#F8FAFC',
            fontFamily: null,
            source: 'default' as const,
          },
        });
      }
    }

    const results: CardWithCompany[] = [];

    for (const rawItem of rawCards) {
      if (!rawItem) continue;
      const item = rawItem as CloudRecord;
      const primaryCard = item.primaryCard as { card?: Card; company?: Company; metrics?: CompanyMetric[]; viceClaims?: ViceClaim[] } | undefined;
      // Handle HydrateCompanyCardResult objects (with primaryCard and cards arrays)
      if (primaryCard?.card && primaryCard?.company) {
        results.push({
          card: { ...primaryCard.card, engine: 'cloud' } as Card,
          company: primaryCard.company,
          metrics: (item.metrics as CompanyMetric[] | undefined) || primaryCard.metrics || [],
          viceClaims: (item.viceClaims as ViceClaim[] | undefined) || primaryCard.viceClaims || [],
        });
        if (Array.isArray(item.cards)) {
          for (const facet of (item.cards as Array<{ card?: Card; company?: Company; metrics?: CompanyMetric[]; viceClaims?: ViceClaim[] }>).slice(1)) {
            if (facet?.card && facet?.company) {
              results.push({
                card: { ...facet.card, engine: 'cloud' } as Card,
                company: facet.company,
                metrics: facet.metrics || [],
                viceClaims: facet.viceClaims || [],
              });
            }
          }
        }
        continue;
      }

      const directCard = item.card as Card | undefined;
      const directCompany = item.company as Company | undefined;
      // Handle direct CardWithCompany objects
      if (directCard && directCompany) {
        results.push({
          card: { ...directCard, engine: 'cloud' } as Card,
          company: directCompany,
          metrics: (item.metrics as CompanyMetric[] | undefined) || [],
          viceClaims: (item.viceClaims as ViceClaim[] | undefined) || [],
        });
        continue;
      }

      // Handle raw card records
      const c = item as CloudRecord;
      const companyId = String(c.companyId || `comp_${String(c.id)}`);
      let company = companyMap.get(companyId);
      if (!company) {
        company = {
          id: companyId,
          name: String(c.companyName || c.title || 'Target Company'),
          oneLiner: String(c.summary || c.descriptor || ''),
          websiteUrl: String(c.websiteUrl || 'https://example.com'),
          logoUrl: (c.logoUrl || null) as string | null,
          hqLocation: (c.hqLocation || null) as string | null,
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

      const card: Card & { engine: string } = {
        id: String(c.id),
        deckId: String(c.deckId || payload.deck?.id || 'dck_cloud'),
        companyId: company.id,
        cardType: (c.cardType || 'company') as Card['cardType'],
        title: String(c.title || company.name),
        summary: String(c.summary || company.oneLiner),
        tier: (c.tier ?? null) as Card['tier'],
        tierReason: (c.tierReason || null) as string | null,
        citations: (c.citations ?? []) as unknown as Citation[],
        keyPoints: (c.keyPoints ?? []) as string[],
        createdAt: String(c.createdAt || new Date().toISOString()),
        engine: 'cloud',
      };

      const companyObj = company;
      const metrics = rawMetrics
        .filter((m: CloudRecord) => m.companyId === companyObj.id) as unknown as CompanyMetric[];
      const viceClaims = rawViceClaims
        .filter((vc: CloudRecord) => vc.cardId === c.id || vc.companyId === companyObj.id) as unknown as ViceClaim[];

      results.push({
        card,
        company: companyObj,
        metrics,
        viceClaims,
      });
    }

    return results;
  }
}
