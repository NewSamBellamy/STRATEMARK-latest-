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
      if (!token || typeof token !== 'string') return null;
      const trimmed = token.trim();
      if (trimmed.length < 20 || trimmed.includes('@') || trimmed === 'demo-user-token' || trimmed.startsWith('demo-')) {
        return null; // raw strings, emails, demo tokens
      }
      const decoded = await getAuth().verifyIdToken(trimmed);
      if (!decoded || !decoded.uid || typeof decoded.uid !== 'string' || decoded.uid.includes('@')) {
        return null;
      }
      return decoded.uid.trim();
    } catch {
      return null;
    }
  }

  async hasActiveEntitlement(uid: string): Promise<boolean> {
    try {
      if (!uid || typeof uid !== 'string') return false;
      const db = getFirestore();
      const doc = await db.collection('entitlements').doc(uid).get();
      if (!doc.exists) return false;
      const data = doc.data();
      const status = data?.status;
      const tier = data?.tier;
      const isValidStatus = status === 'active' || status === 'trialing';
      const isProTier = tier === 'pro' || tier === 'growth' || tier === 'max';
      return Boolean(isValidStatus && isProTier);
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
    if (token === 'valid_other_user') return 'user_999';
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
    if (!token || typeof token !== 'string') return null;
    const trimmed = token.trim();
    if (!trimmed) return null;
    if (trimmed.includes('@') || trimmed === 'demo-user-token' || trimmed.startsWith('demo-')) {
      return null;
    }
    const uid = await this.auth.verifyIdToken(trimmed);
    if (!uid || typeof uid !== 'string' || uid.includes('@') || uid.trim().length === 0) {
      return null;
    }
    return uid.trim();
  }

  async checkEntitlement(uid: string): Promise<boolean> {
    if (!uid || typeof uid !== 'string') return false;
    return this.entitlement.hasActiveEntitlement(uid);
  }

  async getMarkets(uid: string) {
    if (!uid) return [];
    return this.store.listMarkets(uid);
  }

  async getMarket(uid: string, marketId: string) {
    if (!uid || !marketId) return null;
    const market = await this.store.getMarket(marketId);
    if (!market || market.userId !== uid) return null; // 404 anti-enumeration
    return market;
  }

  async getDecks(uid: string) {
    if (!uid) return [];
    return this.store.listDecks(uid);
  }

  async getSavedCards(uid: string) {
    if (!uid) return [];
    return this.store.listSavedCards(uid);
  }

  async saveCard(uid: string, cardId: string, options?: { deckId?: string; deckRevision?: number }) {
    if (!uid || !cardId) throw new Error('Missing parameters');
    await this.store.saveCard(uid, cardId, options);
  }

  async unsaveCard(uid: string, cardId: string) {
    if (!uid || !cardId) return;
    await this.store.unsaveCard(uid, cardId);
  }

  async getDeck(uid: string, deckId: string) {
    if (!uid || !deckId) return null;
    const deck = await this.store.getDeck(deckId);
    if (!deck) return null;
    if (deck.userId !== uid) return null; // cross-owner 404
    return deck;
  }

  async enqueueCreation(payload: TaskPayload) {
    if (!payload.userId) {
      throw new Error('Unauthorized: Missing userId');
    }
    const isEntitled = await this.checkEntitlement(payload.userId);
    if (!isEntitled) {
      throw new Error('Unauthorized: Active entitlement required for cloud operations');
    }
    if (!this.tasks) {
      throw new Error('Cloud Tasks is not configured');
    }
    
    // A changed plan or Market Scope creates a new deck rather than mutating the old operation
    const existing = await this.getDeck(payload.userId, payload.deckId);
    if (existing && existing.plan) {
      const existingMarket = (existing.plan as { marketName?: string })?.marketName;
      if (existingMarket && payload.plan?.marketName && existingMarket.toLowerCase().trim() !== payload.plan.marketName.toLowerCase().trim()) {
        payload.deckId = `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      }
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
    
    await this.saveDeck(payload.userId, payload.deckId, {
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
    if (!uid) throw new Error('Unauthorized');
    const existing = await this.store.getDeck(deckId);
    if (existing && existing.userId && existing.userId !== uid) {
      throw new Error('Not found'); // 404 anti-enumeration
    }
    await this.store.saveDeck(deckId, {
      ...record,
      userId: uid // Immutable owner UID
    }, expectedRevision);
  }
}
