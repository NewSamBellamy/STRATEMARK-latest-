/**
 * Stratemark Data Store — Firestore and in-memory persistence substrate.
 *
 * Provides persistence for living decks, markets, cards, and saved bookmarks
 * in Cloud Firestore under top-level collections ('decks', 'markets', 'saved_cards').
 * Seamlessly integrates with the Cloud Scheduler autonomous delta refresh worklist.
 */
import { Firestore, FieldValue } from '@google-cloud/firestore';
import type { CardWithCompany } from '@mi/contracts';
import type { MarketPlan } from '@mi/research';
import type { RefreshWorklistDeck, WorklistStore } from './worklist';
import type { ServiceEnv } from '../env';

export interface StoredDeckRecord {
  deck: Record<string, unknown>;
  market: Record<string, unknown>;
  cards: CardWithCompany[];
  plan?: MarketPlan | Record<string, unknown>;
  state?: Record<string, unknown>;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  refreshedAt?: string;
  query?: string;
  watch?: boolean;
  revision?: number;
  schemaVersion?: number;
}

export interface StratemarkDataStore extends WorklistStore {
  saveDeck(deckId: string, record: StoredDeckRecord, expectedRevision?: number): Promise<void>;
  getDeck(deckId: string): Promise<StoredDeckRecord | null>;
  listDecks(userId?: string): Promise<Array<Record<string, unknown>>>;
  deleteDeck(deckId: string): Promise<void>;

  saveMarket(marketId: string, market: Record<string, unknown>, userId?: string, expectedRevision?: number): Promise<void>;
  getMarket(marketId: string): Promise<Record<string, unknown> | null>;
  listMarkets(userId?: string): Promise<Array<Record<string, unknown>>>;

  saveCard(userId: string, cardId: string, options?: { deckId?: string; deckRevision?: number }): Promise<void>;
  unsaveCard(userId: string, cardId: string): Promise<void>;
  listSavedCards(userId: string): Promise<Array<Record<string, unknown>>>;
}

export class MemoryDataStore implements StratemarkDataStore {
  private decks = new Map<string, StoredDeckRecord>();
  private markets = new Map<string, Record<string, unknown>>();
  private savedCards = new Map<string, { userId: string; cardId: string; data?: Record<string, unknown>; savedAt: string }>();

  async saveDeck(deckId: string, record: StoredDeckRecord, expectedRevision?: number): Promise<void> {
    const existing = this.decks.get(deckId);
    const currentRev = existing?.revision ?? 0;
    
    if (expectedRevision !== undefined && expectedRevision !== currentRev) {
      const err = new Error(`Revision mismatch: expected ${expectedRevision}, got ${currentRev}`) as Error & { status?: number };
      err.status = 409;
      throw err;
    }

    const nextRev = currentRev + 1;
    const now = new Date().toISOString();

    const newRecord = { 
      ...record, 
      revision: nextRev,
      createdAt: existing?.createdAt ?? record.createdAt ?? now,
      updatedAt: now,
      refreshedAt: record.refreshedAt ?? now
    };
    
    this.decks.set(deckId, newRecord);
    if (record.market) {
      const marketId = String(record.market.id || record.market.marketId || deckId);
      await this.saveMarket(marketId, record.market, record.userId, expectedRevision);
    }
  }

  async getDeck(deckId: string): Promise<StoredDeckRecord | null> {
    const d = this.decks.get(deckId);
    return d ? { ...d } : null;
  }

  async listDecks(userId?: string): Promise<Array<Record<string, unknown>>> {
    const list: Array<Record<string, unknown>> = [];
    for (const record of this.decks.values()) {
      if (!userId || record.userId === userId) {
        list.push(record.deck);
      }
    }
    return list;
  }

  async deleteDeck(deckId: string): Promise<void> {
    this.decks.delete(deckId);
    this.markets.delete(deckId);
  }

  async saveMarket(marketId: string, market: Record<string, unknown>, userId?: string, expectedRevision?: number): Promise<void> {
    const existing = this.markets.get(marketId);
    const currentRev = (existing?.revision as number) ?? 0;

    if (expectedRevision !== undefined && expectedRevision !== currentRev) {
      const err = new Error(`Revision mismatch: expected ${expectedRevision}, got ${currentRev}`) as Error & { status?: number };
      err.status = 409;
      throw err;
    }

    const nextRev = currentRev + 1;
    this.markets.set(marketId, { 
      ...market, 
      ...(userId ? { userId } : {}),
      revision: nextRev,
      updatedAt: new Date().toISOString()
    });
  }

  async getMarket(marketId: string): Promise<Record<string, unknown> | null> {
    const m = this.markets.get(marketId);
    return m ? { ...m } : null;
  }

  async listMarkets(userId?: string): Promise<Array<Record<string, unknown>>> {
    const list: Array<Record<string, unknown>> = [];
    for (const m of this.markets.values()) {
      if (!userId || m.userId === userId) {
        list.push(m);
      }
    }
    return list;
  }

  async saveCard(userId: string, cardId: string, options?: { deckId?: string; deckRevision?: number }): Promise<void> {
    const key = `${userId}_${cardId}`;
    this.savedCards.set(key, {
      userId,
      cardId,
      data: options as Record<string, unknown>,
      savedAt: new Date().toISOString(),
    });
  }

  async unsaveCard(userId: string, cardId: string): Promise<void> {
    const key = `${userId}_${cardId}`;
    this.savedCards.delete(key);
  }

  async listSavedCards(userId: string): Promise<Array<Record<string, unknown>>> {
    const list: Array<Record<string, unknown>> = [];
    for (const item of this.savedCards.values()) {
      if (item.userId === userId) {
        list.push({
          id: item.cardId,
          cardId: item.cardId,
          userId: item.userId,
          savedAt: item.savedAt,
          ...(item.data || {}),
        });
      }
    }
    return list;
  }

  // WorklistStore implementation for autonomous delta refresh
  async getDecks(): Promise<RefreshWorklistDeck[]> {
    const results: RefreshWorklistDeck[] = [];
    for (const [id, record] of this.decks.entries()) {
      const planName = typeof record.plan?.marketName === 'string' ? record.plan.marketName : '';
      const marketName = typeof record.market?.name === 'string' ? record.market.name : '';
      const query = record.query || planName || marketName || id;
      results.push({
        deckId: id,
        userId: record.userId || 'unknown',
        query,
        updatedAt: record.updatedAt || record.refreshedAt,
        cards: record.cards,
      });
    }
    return results;
  }

  async saveRefreshedDeck(deckId: string, data: { cards: CardWithCompany[]; refreshedAt: string }): Promise<void> {
    const existing = this.decks.get(deckId);
    if (existing) {
      existing.cards = data.cards;
      existing.refreshedAt = data.refreshedAt;
      existing.updatedAt = data.refreshedAt;
      this.decks.set(deckId, existing);
    }
  }
}

export interface FirestoreStoreOptions {
  projectId?: string;
  decksCollection?: string;
  marketsCollection?: string;
  savedCardsCollection?: string;
  firestore?: Firestore;
}

export class FirestoreDataStore implements StratemarkDataStore {
  private firestore: Firestore;
  private decksCol: string;
  private marketsCol: string;
  private savedCardsCol: string;

  constructor(options?: FirestoreStoreOptions) {
    this.firestore =
      options?.firestore ??
      new Firestore({
        ...(options?.projectId ? { projectId: options.projectId } : {}),
      });
    this.decksCol = options?.decksCollection ?? 'decks';
    this.marketsCol = options?.marketsCollection ?? 'markets';
    this.savedCardsCol = options?.savedCardsCollection ?? 'saved_cards';
  }

  async saveDeck(deckId: string, record: StoredDeckRecord, expectedRevision?: number): Promise<void> {
    try {
      await this.firestore.runTransaction(async (t) => {
        const deckRef = this.firestore.collection(this.decksCol).doc(deckId);
        const deckDoc = await t.get(deckRef);
        
        const currentRev = deckDoc.exists ? ((deckDoc.data()?.revision as number) ?? 0) : 0;
        
        if (deckDoc.exists && deckDoc.data()?.userId && deckDoc.data()?.userId !== record.userId) {
          throw new Error('Not found'); // 404 anti-enumeration
        }
        
        if (expectedRevision !== undefined && currentRev !== expectedRevision) {
          throw new Error(`Revision mismatch: expected ${expectedRevision}, got ${currentRev}`);
        }
        
        const nextRev = currentRev + 1;
        const now = FieldValue.serverTimestamp();
        
        const payload = {
          id: deckId,
          deckId,
          deck: record.deck,
          market: record.market,
          cards: record.cards,
          plan: record.plan ?? null,
          state: record.state ?? null,
          query:
            record.query ??
            (typeof record.plan?.marketName === 'string' ? record.plan.marketName : '') ??
            (typeof record.market?.name === 'string' ? record.market.name : ''),
          ...(record.userId ? { userId: record.userId } : {}),
          createdAt: deckDoc.exists ? deckDoc.data()?.createdAt : now,
          updatedAt: now,
          refreshedAt: record.refreshedAt ?? now,
          revision: nextRev,
          schemaVersion: 1,
        };
        
        t.set(deckRef, payload, { merge: true });

        if (record.market) {
          const marketId = String(record.market.id || record.market.marketId || deckId);
          const marketRef = this.firestore.collection(this.marketsCol).doc(marketId);
          t.set(marketRef, {
            ...record.market,
            id: marketId,
            marketId,
            ...(record.userId ? { userId: record.userId } : {}),
            updatedAt: now,
            revision: nextRev,
          }, { merge: true });
        }
      });
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      if (err.message?.includes('Revision mismatch')) {
        err.status = 409;
        throw err;
      }
      if (err.message?.includes('exceeds the maximum allowed size')) {
        err.status = 413;
        throw err;
      }
      // "Production persistence failure returns an explicit 503"
      const wrapped = new Error(`Persistence failure: ${err.message}`) as Error & { status?: number };
      wrapped.status = 503;
      throw wrapped;
    }
  }

  async getDeck(deckId: string): Promise<StoredDeckRecord | null> {
    const docRef = this.firestore.collection(this.decksCol).doc(deckId);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data) return null;

    const tsToStr = (val: unknown) => {
      if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
        return (val as { toDate: () => Date }).toDate().toISOString();
      }
      return typeof val === 'string' ? val : undefined;
    };

    return {
      deck: (data.deck as Record<string, unknown>) ?? { id: deckId, marketId: deckId, engine: 'cloud' },
      market: (data.market as Record<string, unknown>) ?? { id: deckId, name: data.query ?? deckId },
      cards: Array.isArray(data.cards) ? (data.cards as CardWithCompany[]) : [],
      plan: data.plan as Record<string, unknown> | undefined,
      state: data.state as Record<string, unknown> | undefined,
      userId: typeof data.userId === 'string' ? data.userId : undefined,
      createdAt: tsToStr(data.createdAt),
      updatedAt: tsToStr(data.updatedAt),
      refreshedAt: tsToStr(data.refreshedAt),
      query: typeof data.query === 'string' ? data.query : undefined,
      revision: typeof data.revision === 'number' ? data.revision : undefined,
    };
  }

  async listDecks(userId?: string): Promise<Array<Record<string, unknown>>> {
    let query: FirebaseFirestore.Query = this.firestore.collection(this.decksCol);
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    const snap = await query.limit(100).get();
    const decks: Array<Record<string, unknown>> = [];
    const tsToStr = (val: unknown) => {
      if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
        return (val as { toDate: () => Date }).toDate().toISOString();
      }
      return typeof val === 'string' ? val : undefined;
    };

    snap.forEach((doc) => {
      const data = doc.data();
      if (data?.deck) {
        decks.push(data.deck as Record<string, unknown>);
      } else if (data) {
        decks.push({
          id: doc.id,
          marketId: doc.id,
          title: data.query ?? doc.id,
          createdAt: tsToStr(data.createdAt),
          updatedAt: tsToStr(data.updatedAt),
          engine: 'cloud',
        });
      }
    });
    return decks;
  }

  async deleteDeck(deckId: string): Promise<void> {
    await Promise.all([
      this.firestore.collection(this.decksCol).doc(deckId).delete(),
      this.firestore.collection(this.marketsCol).doc(deckId).delete(),
    ]);
  }

  async saveMarket(marketId: string, market: Record<string, unknown>, userId?: string, expectedRevision?: number): Promise<void> {
    try {
      await this.firestore.runTransaction(async (t) => {
        const docRef = this.firestore.collection(this.marketsCol).doc(marketId);
        const docSnap = await t.get(docRef);
        const currentRev = docSnap.exists ? ((docSnap.data()?.revision as number) ?? 0) : 0;
        
        if (docSnap.exists && docSnap.data()?.userId && docSnap.data()?.userId !== userId) {
          throw new Error('Not found'); // 404 anti-enumeration
        }

        if (expectedRevision !== undefined && currentRev !== expectedRevision) {
          throw new Error(`Revision mismatch: expected ${expectedRevision}, got ${currentRev}`);
        }
        
        const nextRev = currentRev + 1;
        t.set(
          docRef,
          {
            ...market,
            id: marketId,
            marketId,
            ...(userId ? { userId } : {}),
            updatedAt: FieldValue.serverTimestamp(),
            revision: nextRev,
          },
          { merge: true },
        );
      });
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      if (err.message?.includes('Revision mismatch')) {
        err.status = 409;
        throw err;
      }
      const wrapped = new Error(`Persistence failure: ${err.message}`) as Error & { status?: number };
      wrapped.status = 503;
      throw wrapped;
    }
  }

  async getMarket(marketId: string): Promise<Record<string, unknown> | null> {
    const snap = await this.firestore.collection(this.marketsCol).doc(marketId).get();
    if (!snap.exists) return null;
    return (snap.data() as Record<string, unknown>) ?? null;
  }

  async listMarkets(userId?: string): Promise<Array<Record<string, unknown>>> {
    let query: FirebaseFirestore.Query = this.firestore.collection(this.marketsCol);
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    const snap = await query.limit(100).get();
    const markets: Array<Record<string, unknown>> = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data) {
        markets.push(data as Record<string, unknown>);
      }
    });
    return markets;
  }

  async saveCard(userId: string, cardId: string, options?: { deckId?: string; deckRevision?: number }): Promise<void> {
    const docId = `${userId}_${cardId}`;
    const docRef = this.firestore.collection(this.savedCardsCol).doc(docId);
    await docRef.set(
      {
        userId,
        cardId,
        savedAt: FieldValue.serverTimestamp(),
        ...(options?.deckId ? { deckId: options.deckId } : {}),
        ...(options?.deckRevision !== undefined ? { deckRevision: options.deckRevision } : {}),
      },
      { merge: true },
    );
  }

  async unsaveCard(userId: string, cardId: string): Promise<void> {
    const docId = `${userId}_${cardId}`;
    await this.firestore.collection(this.savedCardsCol).doc(docId).delete();
  }

  async listSavedCards(userId: string): Promise<Array<Record<string, unknown>>> {
    const query = this.firestore
      .collection(this.savedCardsCol)
      .where('userId', '==', userId)
      .limit(200);
    const snap = await query.get();
    const cards: Array<Record<string, unknown>> = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data) {
        cards.push({
          id: data.cardId,
          cardId: data.cardId,
          userId: data.userId,
          savedAt: data.savedAt,
          ...data,
        });
      }
    });
    return cards;
  }

  // WorklistStore implementation
  async getDecks(): Promise<RefreshWorklistDeck[]> {
    const snap = await this.firestore.collection(this.decksCol).limit(50).get();
    const decks: RefreshWorklistDeck[] = [];
    const tsToStr = (val: unknown) => {
      if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
        return (val as { toDate: () => Date }).toDate().toISOString();
      }
      return typeof val === 'string' ? val : undefined;
    };

    snap.forEach((doc) => {
      const data = doc.data();
      if (data && (data.query || data.title || data.deckId || data.id)) {
          decks.push({
            deckId: String(data.deckId || doc.id),
            userId: String(data.userId || 'unknown'),
            query: String(data.query || data.title || doc.id),
            updatedAt: tsToStr(data.updatedAt) ?? tsToStr(data.refreshedAt),
            cards: Array.isArray(data.cards) ? data.cards : [],
          });
      }
    });
    return decks;
  }

  async saveRefreshedDeck(deckId: string, data: { cards: CardWithCompany[]; refreshedAt: string }): Promise<void> {
    await this.firestore.runTransaction(async (t) => {
      const deckRef = this.firestore.collection(this.decksCol).doc(deckId);
      const deckDoc = await t.get(deckRef);
      if (!deckDoc.exists) return; // or throw
      const now = FieldValue.serverTimestamp();
      
      const currentRev = (deckDoc.data()?.revision as number) ?? 0;
      t.set(
        deckRef,
        {
          cards: data.cards,
          updatedAt: now,
          refreshedAt: now,
          revision: currentRev + 1,
        },
        { merge: true },
      );
    });
  }
}

/**
 * Creates the appropriate Stratemark data store based on environment and options.
 */
export function createDataStore(
  env: ServiceEnv,
  options?: {
    store?: StratemarkDataStore;
    firestore?: Firestore;
    forceMemory?: boolean;
  },
): StratemarkDataStore {
  if (options?.store) {
    return options.store;
  }

  if (options?.forceMemory) {
    return new MemoryDataStore();
  }

  const projectId =
    env.vertex?.project ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIRESTORE_PROJECT_ID;

  const hasFirestoreEnv = Boolean(projectId || process.env.FIRESTORE_EMULATOR_HOST);

  if (hasFirestoreEnv || options?.firestore) {
    try {
      return new FirestoreDataStore({
        projectId,
        firestore: options?.firestore,
      });
    } catch {
      return new MemoryDataStore();
    }
  }

  return new MemoryDataStore();
}
