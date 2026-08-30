import { describe, it, expect, vi } from 'vitest';
import type { Firestore } from '@google-cloud/firestore';
import type { CardWithCompany } from '@mi/contracts';
import {
  MemoryDataStore,
  FirestoreDataStore,
  createDataStore,
  type StoredDeckRecord,
} from '../lib/firestoreStore';
import type { ServiceEnv } from '../env';

const mockEnv: ServiceEnv = {
  port: 8080,
  geminiApiKey: 'k',
  vertex: undefined,
  allowedOrigins: [],
  schedulerToken: 'secret',
  schedulerServiceAccountEmail: 'scheduler@example.com',
  appToken: 'secret',
  dailyCapUsd: 10,
  captureBlocklist: [],
};

describe('MemoryDataStore', () => {
  it('saves, retrieves, lists and deletes decks and markets, and respects revisions', async () => {
    const store = new MemoryDataStore();
    const record: StoredDeckRecord = {
      deck: { id: 'deck_1', title: 'AI Infrastructure', engine: 'cloud' },
      market: { id: 'deck_1', name: 'AI Infrastructure' },
      cards: [],
      plan: { marketName: 'AI Infrastructure', vertical: 'tech' },
      userId: 'user_123',
    };

    await store.saveDeck('deck_1', record);

    const fetchedDeck = await store.getDeck('deck_1');
    expect(fetchedDeck).not.toBeNull();
    expect(fetchedDeck?.deck.title).toBe('AI Infrastructure');
    expect(fetchedDeck?.userId).toBe('user_123');
    expect(fetchedDeck?.revision).toBe(1);

    // Test successful revision update
    await store.saveDeck('deck_1', { ...record, cards: [{ title: 'New Card' } as unknown as CardWithCompany] }, 1);
    const updatedDeck = await store.getDeck('deck_1');
    expect(updatedDeck?.revision).toBe(2);

    // Test stale revision rejection
    await expect(store.saveDeck('deck_1', record, 1)).rejects.toThrow(/Revision mismatch/);

    const fetchedMarket = await store.getMarket('deck_1');
    expect(fetchedMarket?.name).toBe('AI Infrastructure');
    expect(fetchedMarket?.revision).toBe(2);

    const userDecks = await store.listDecks('user_123');
    expect(userDecks.length).toBe(1);
    expect(userDecks[0]?.id).toBe('deck_1');

    const otherUserDecks = await store.listDecks('user_456');
    expect(otherUserDecks.length).toBe(0);

    const allMarkets = await store.listMarkets();
    expect(allMarkets.length).toBe(1);

    // Test Worklist methods
    const worklistDecks = await store.getDecks();
    expect(worklistDecks.length).toBe(1);
    expect(worklistDecks[0]?.query).toBe('AI Infrastructure');

    await store.saveRefreshedDeck('deck_1', {
      cards: [],
      refreshedAt: '2026-08-30T12:00:00Z',
    });
    const refreshed = await store.getDeck('deck_1');
    expect(refreshed?.refreshedAt).toBe('2026-08-30T12:00:00Z');

    // Delete deck
    await store.deleteDeck('deck_1');
    expect(await store.getDeck('deck_1')).toBeNull();
    expect(await store.getMarket('deck_1')).toBeNull();
  });

  it('manages user saved card bookmarks', async () => {
    const store = new MemoryDataStore();
    await store.saveCard('user_1', 'card_abc', { deckId: 'deck_1', deckRevision: 1 });
    await store.saveCard('user_1', 'card_xyz', { deckId: 'deck_1' });
    await store.saveCard('user_2', 'card_abc', { deckId: 'deck_2' });

    const user1Cards = await store.listSavedCards('user_1');
    expect(user1Cards.length).toBe(2);
    expect(user1Cards.map((c) => c.cardId)).toContain('card_abc');
    expect(user1Cards.map((c) => c.cardId)).toContain('card_xyz');

    await store.unsaveCard('user_1', 'card_abc');
    const user1CardsAfter = await store.listSavedCards('user_1');
    expect(user1CardsAfter.length).toBe(1);
    expect(user1CardsAfter[0]?.cardId).toBe('card_xyz');

    // user_2 still has card_abc
    const user2Cards = await store.listSavedCards('user_2');
    expect(user2Cards.length).toBe(1);
    expect(user2Cards[0]?.cardId).toBe('card_abc');
  });
});

describe('FirestoreDataStore', () => {
  it('interacts with Firestore API collections for decks and markets', async () => {
    const mockDocSet = vi.fn(async () => undefined);
    const mockDocDelete = vi.fn(async () => undefined);
    const mockDocGet = vi.fn(async () => ({
      exists: true,
      data: () => ({
        id: 'deck_f1',
        deck: { id: 'deck_f1', title: 'Frontier AI' },
        market: { id: 'deck_f1', name: 'Frontier AI' },
        cards: [],
        query: 'Frontier AI',
        userId: 'user_99',
        revision: 1
      }),
    }));

    const mockCollectionGet = vi.fn(async () => ({
      forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
        cb({
          id: 'deck_f1',
          data: () => ({
            id: 'deck_f1',
            deck: { id: 'deck_f1', title: 'Frontier AI' },
            query: 'Frontier AI',
            cards: [],
          }),
        });
      },
    }));

    const mockRunTransaction = vi.fn(async (cb) => {
      const t = {
        get: mockDocGet,
        set: mockDocSet,
      };
      return cb(t);
    });

    const mockFirestore = {
      collection: vi.fn((_colName: string) => ({
        doc: vi.fn((_id: string) => ({
          set: mockDocSet,
          get: mockDocGet,
          delete: mockDocDelete,
        })),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: mockCollectionGet,
      })),
      runTransaction: mockRunTransaction,
    } as unknown as Firestore;

    const store = new FirestoreDataStore({ firestore: mockFirestore });

    await store.saveDeck('deck_f1', {
      deck: { id: 'deck_f1', title: 'Frontier AI' },
      market: { id: 'deck_f1', name: 'Frontier AI' },
      cards: [],
      userId: 'user_99',
    }, 1);

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockDocSet).toHaveBeenCalledTimes(2); // one for deck, one for market

    // Rejection on revision mismatch
    await expect(store.saveDeck('deck_f1', { deck: {}, market: {}, cards: [], userId: 'user_99' }, 2)).rejects.toThrow(/Revision mismatch/);

    const deck = await store.getDeck('deck_f1');
    expect(deck?.deck.title).toBe('Frontier AI');

    const decks = await store.listDecks('user_99');
    expect(decks.length).toBe(1);

    const worklist = await store.getDecks();
    expect(worklist.length).toBe(1);
    expect(worklist[0]?.deckId).toBe('deck_f1');

    await store.deleteDeck('deck_f1');
    expect(mockDocDelete).toHaveBeenCalled();
  });
});

describe('createDataStore factory', () => {
  it('creates MemoryDataStore when forceMemory is set', () => {
    const store = createDataStore(mockEnv, { forceMemory: true });
    expect(store instanceof MemoryDataStore).toBe(true);
  });

  it('uses passed store instance', () => {
    const memStore = new MemoryDataStore();
    const store = createDataStore(mockEnv, { store: memStore });
    expect(store).toBe(memStore);
  });
});
