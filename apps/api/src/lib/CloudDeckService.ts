import type { StratemarkDataStore, StoredDeckRecord } from './firestoreStore';
import type { TasksAdapter, TaskPayload } from './CloudTasksAdapter';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

export interface AuthAdapter {
  verifyIdToken(token: string): Promise<string | null>;
}

export interface EntitlementAdapter {
  hasActiveEntitlement(uid: string): Promise<boolean>;
}

export class FirebaseAdapter implements AuthAdapter, EntitlementAdapter {
  constructor() {
    if (getApps().length === 0) {
      initializeApp();
    }
  }

  async verifyIdToken(token: string): Promise<string | null> {
    try {
      if (!token) return null;
      if (token === 'demo-user-token' || token.length < 20) return null; // raw strings
      const decoded = await getAuth().verifyIdToken(token);
      return decoded.uid;
    } catch {
      return null;
    }
  }

  async hasActiveEntitlement(uid: string): Promise<boolean> {
    try {
      const db = getFirestore();
      const doc = await db.collection('entitlements').doc(uid).get();
      if (!doc.exists) return false;
      const data = doc.data();
      return data?.status === 'active' && data?.tier === 'pro';
    } catch {
      return false;
    }
  }
}

export class MockFirebaseAdapter implements AuthAdapter, EntitlementAdapter {
  async verifyIdToken(token: string): Promise<string | null> {
    if (token === 'valid_token') return 'user_123';
    if (token === 'valid_pro_token') return 'user_pro';
    if (token === 'valid_free_token') return 'user_free';
    return null;
  }

  async hasActiveEntitlement(uid: string): Promise<boolean> {
    if (uid === 'user_123' || uid === 'user_pro') return true;
    return false;
  }
}

export class CloudDeckService {
  constructor(
    private readonly store: StratemarkDataStore,
    private readonly auth: AuthAdapter,
    private readonly entitlement: EntitlementAdapter,
    private readonly tasks?: TasksAdapter
  ) {}

  async authenticate(token?: string): Promise<string | null> {
    if (!token) return null;
    return this.auth.verifyIdToken(token);
  }

  async checkEntitlement(uid: string): Promise<boolean> {
    return this.entitlement.hasActiveEntitlement(uid);
  }

  async getMarkets(uid: string) {
    return this.store.listMarkets(uid);
  }

  async getMarket(uid: string, marketId: string) {
    const market = await this.store.getMarket(marketId);
    if (!market || market.userId !== uid) return null;
    return market;
  }

  async getDecks(uid: string) {
    return this.store.listDecks(uid);
  }

  async getSavedCards(uid: string) {
    return this.store.listSavedCards(uid);
  }

  async saveCard(uid: string, cardId: string, options?: { deckId?: string; deckRevision?: number }) {
    await this.store.saveCard(uid, cardId, options);
  }

  async unsaveCard(uid: string, cardId: string) {
    await this.store.unsaveCard(uid, cardId);
  }

  async getDeck(uid: string, deckId: string) {
    const deck = await this.store.getDeck(deckId);
    if (!deck) return null;
    if (deck.userId !== uid) return null; // cross-owner 404
    return deck;
  }

  async enqueueCreation(payload: TaskPayload) {
    if (!this.tasks) {
      throw new Error('Cloud Tasks is not configured');
    }
    
    // Save initial running state
    const now = new Date().toISOString();
    const marketObj = {
      id: payload.deckId,
      marketId: payload.deckId,
      name: payload.plan.marketName,
      scopeDefinition: { vertical: payload.plan.vertical, geography: payload.plan.geography, notes: payload.plan.notes },
      refreshCadence: 'weekly',
      createdAt: now,
      engine: 'cloud',
    };
    const deckObj = {
      id: payload.deckId,
      marketId: payload.deckId,
      createdAt: now,
      lastRefreshedAt: now,
      engine: 'cloud',
    };
    
    await this.store.saveDeck(payload.deckId, {
      deck: deckObj,
      market: marketObj,
      cards: [],
      plan: payload.plan,
      state: { status: 'running' },
      userId: payload.userId,
      query: payload.plan.marketName,
      watch: payload.watch,
    });

    await this.tasks.enqueueDeckCreation(payload);
  }
  async deleteDeck(uid: string, deckId: string) {
    const deck = await this.getDeck(uid, deckId);
    if (!deck) return false;
    await this.store.deleteDeck(deckId);
    return true;
  }
  
  async saveDeck(uid: string, deckId: string, record: StoredDeckRecord, expectedRevision?: number) {
    await this.store.saveDeck(deckId, {
      ...record,
      userId: uid
    }, expectedRevision);
  }
}
