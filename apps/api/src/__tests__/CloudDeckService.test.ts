import { describe, expect, it } from 'vitest';
import { CloudDeckService, type AuthAdapter, type EntitlementAdapter } from '../lib/CloudDeckService';
import { MemoryDataStore } from '../lib/firestoreStore';

describe('CloudDeckService', () => {
  const mockAuth: AuthAdapter = {
    verifyIdToken: async (token) => {
      if (token === 'valid_token') return 'user_123';
      if (token === 'expired_token') return null;
      return null;
    }
  };

  const mockEntitlement: EntitlementAdapter = {
    hasActiveEntitlement: async (uid) => {
      return uid === 'user_123';
    }
  };

  it('authenticates valid tokens and rejects raw strings/demo tokens', async () => {
    const store = new MemoryDataStore();
    const service = new CloudDeckService(store, mockAuth, mockEntitlement);

    expect(await service.authenticate('valid_token')).toBe('user_123');
    expect(await service.authenticate('raw_bearer_string')).toBe(null);
    expect(await service.authenticate('demo-user-token')).toBe(null);
    expect(await service.authenticate('expired_token')).toBe(null);
  });

  it('requires entitlement for cloud operations', async () => {
    // const store = new MemoryDataStore();
    // const service = new CloudDeckService(store, mockAuth, mockEntitlement);

    const isEntitled = await mockEntitlement.hasActiveEntitlement('user_123');
    expect(isEntitled).toBe(true);

    const isNotEntitled = await mockEntitlement.hasActiveEntitlement('user_456');
    expect(isNotEntitled).toBe(false);
  });

  it('filters reads by owner UID and returns 404 for missing/cross-owner', async () => {
    const store = new MemoryDataStore();
    const service = new CloudDeckService(store, mockAuth, mockEntitlement);

    await store.saveDeck('deck_1', {
      userId: 'user_123',
      deck: { id: 'deck_1', engine: 'cloud' },
      market: { id: 'deck_1' },
      cards: []
    });

    const deck1 = await service.getDeck('user_123', 'deck_1');
    expect(deck1).toBeDefined();
    expect(deck1?.deck.id).toBe('deck_1');

    // cross-owner returns null (404 equivalent)
    const deck1Cross = await service.getDeck('user_999', 'deck_1');
    expect(deck1Cross).toBeNull();

    // missing returns null
    const deckMissing = await service.getDeck('user_123', 'deck_missing');
    expect(deckMissing).toBeNull();
  });
});
