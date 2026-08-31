import { describe, expect, it, vi } from 'vitest';
import { CloudDeckService, type AuthAdapter, type EntitlementAdapter } from '../lib/CloudDeckService';
import { MemoryDataStore } from '../lib/firestoreStore';
import type { TasksAdapter, TaskPayload } from '../lib/CloudTasksAdapter';

describe('CloudDeckService', () => {
  const mockAuth: AuthAdapter = {
    verifyIdToken: async (token) => {
      if (token === 'valid_token') return 'user_123';
      if (token === 'valid_pro_token') return 'user_pro';
      if (token === 'valid_free_token') return 'user_free';
      if (token === 'valid_other_user') return 'user_999';
      if (token === 'expired_token') return null;
      return null;
    }
  };

  const mockEntitlement: EntitlementAdapter = {
    hasActiveEntitlement: async (uid) => {
      return uid === 'user_123' || uid === 'user_pro';
    }
  };

  it('authenticates valid tokens and rejects raw strings, emails, and demo tokens', async () => {
    const store = new MemoryDataStore();
    const service = new CloudDeckService(store, mockAuth, mockEntitlement);

    expect(await service.authenticate('valid_token')).toBe('user_123');
    expect(await service.authenticate('valid_pro_token')).toBe('user_pro');
    expect(await service.authenticate('raw_bearer_string')).toBe(null);
    expect(await service.authenticate('demo-user-token')).toBe(null);
    expect(await service.authenticate('demo-test-123')).toBe(null);
    expect(await service.authenticate('user@stratemark.com')).toBe(null);
    expect(await service.authenticate('expired_token')).toBe(null);
    expect(await service.authenticate('')).toBe(null);
    expect(await service.authenticate(undefined)).toBe(null);
  });

  it('requires entitlement for cloud operations', async () => {
    const store = new MemoryDataStore();
    const service = new CloudDeckService(store, mockAuth, mockEntitlement);

    expect(await service.checkEntitlement('user_123')).toBe(true);
    expect(await service.checkEntitlement('user_pro')).toBe(true);
    expect(await service.checkEntitlement('user_free')).toBe(false);
    expect(await service.checkEntitlement('user_unknown')).toBe(false);
  });

  it('filters reads by owner UID and returns indistinguishable 404 (null) for missing and cross-owner', async () => {
    const store = new MemoryDataStore();
    const service = new CloudDeckService(store, mockAuth, mockEntitlement);

    await service.saveDeck('user_123', 'deck_1', {
      userId: 'user_123',
      deck: { id: 'deck_1', engine: 'cloud' },
      market: { id: 'deck_1', name: 'AI Market' },
      cards: []
    });

    // Owner read
    const deck1 = await service.getDeck('user_123', 'deck_1');
    expect(deck1).toBeDefined();
    expect(deck1?.deck.id).toBe('deck_1');

    // Cross-owner returns null (indistinguishable from missing)
    const deck1Cross = await service.getDeck('user_999', 'deck_1');
    expect(deck1Cross).toBeNull();

    // Missing returns null
    const deckMissing = await service.getDeck('user_123', 'deck_missing');
    expect(deckMissing).toBeNull();

    // Market reads follow same rule
    const marketOwner = await service.getMarket('user_123', 'deck_1');
    expect(marketOwner).toBeDefined();
    const marketCross = await service.getMarket('user_999', 'deck_1');
    expect(marketCross).toBeNull();
    const marketMissing = await service.getMarket('user_123', 'market_missing');
    expect(marketMissing).toBeNull();
  });

  it('enforces immutable owner UID and prevents cross-owner overwrites', async () => {
    const store = new MemoryDataStore();
    const service = new CloudDeckService(store, mockAuth, mockEntitlement);

    // Initial save sets user_123
    await service.saveDeck('user_123', 'deck_immutable', {
      deck: { id: 'deck_immutable' },
      market: { id: 'deck_immutable' },
      cards: [],
      userId: 'user_spoofed' // should be ignored and bound to caller
    });

    const fetched = await service.getDeck('user_123', 'deck_immutable');
    expect(fetched?.userId).toBe('user_123');

    // Cross-owner write attempt throws Not found (404 anti-enumeration)
    await expect(
      service.saveDeck('user_999', 'deck_immutable', {
        deck: { id: 'deck_immutable' },
        market: { id: 'deck_immutable' },
        cards: []
      })
    ).rejects.toThrow(/Not found/i);
  });

  it('filters delete operations by owner UID and returns false for missing or cross-owner', async () => {
    const store = new MemoryDataStore();
    const service = new CloudDeckService(store, mockAuth, mockEntitlement);

    await service.saveDeck('user_123', 'deck_del', {
      deck: { id: 'deck_del' },
      market: { id: 'deck_del' },
      cards: []
    });

    // Cross-owner delete returns false (indistinguishable from missing)
    expect(await service.deleteDeck('user_999', 'deck_del')).toBe(false);
    expect(await service.deleteDeck('user_123', 'deck_missing')).toBe(false);

    // Owner delete succeeds
    expect(await service.deleteDeck('user_123', 'deck_del')).toBe(true);
    expect(await service.getDeck('user_123', 'deck_del')).toBeNull();
  });

  it('enqueueCreation validates entitlement and persists initial running state', async () => {
    const store = new MemoryDataStore();
    const mockTasks: TasksAdapter = {
      enqueueDeckCreation: vi.fn(),
      enqueueDeckRefresh: vi.fn(),
    };
    const service = new CloudDeckService(store, mockAuth, mockEntitlement, mockTasks);

    const taskPayload: TaskPayload = {
      deckId: 'deck_queued',
      userId: 'user_pro',
      plan: { marketName: 'Robotics', vertical: 'Hardware', geography: null, notes: null, searchThemes: [] },
      query: 'Robotics',
      maxCandidates: 2,
    };

    // Entitled user succeeds
    await service.enqueueCreation(taskPayload);
    expect(mockTasks.enqueueDeckCreation).toHaveBeenCalledWith(taskPayload);

    const initialDeck = await service.getDeck('user_pro', 'deck_queued');
    expect(initialDeck?.state).toEqual({ status: 'running' });
    expect(initialDeck?.userId).toBe('user_pro');

    // Unentitled user is rejected
    const unentitledPayload: TaskPayload = {
      ...taskPayload,
      deckId: 'deck_unentitled',
      userId: 'user_free',
    };
    await expect(service.enqueueCreation(unentitledPayload)).rejects.toThrow(/entitlement/i);
  });

  it('supports injecting custom adapters at the seam', () => {
    const customStore = new MemoryDataStore();
    const customAuth: AuthAdapter = { verifyIdToken: async () => 'custom_user' };
    const customEntitlement: EntitlementAdapter = { hasActiveEntitlement: async () => true };
    const customTasks: TasksAdapter = { enqueueDeckCreation: vi.fn(), enqueueDeckRefresh: vi.fn() };

    const service = new CloudDeckService(customStore, customAuth, customEntitlement, customTasks);
    expect(service).toBeInstanceOf(CloudDeckService);
  });
});
