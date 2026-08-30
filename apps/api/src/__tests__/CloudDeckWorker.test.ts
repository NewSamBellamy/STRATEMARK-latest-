import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudDeckWorker } from '../lib/CloudDeckWorker';
import { CloudDeckService, MockFirebaseAdapter } from '../lib/CloudDeckService';
import { MemoryDataStore } from '../lib/firestoreStore';
import { MockTasksAdapter } from '../lib/CloudTasksAdapter';
import type { ServiceEnv } from '../env';
import { runLivingDeckEngine, type LivingDeckRun, type HydrateCompanyCardResult } from '@mi/research';

vi.mock('@mi/research', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@mi/research')>();
  return {
    ...actual,
    runLivingDeckEngine: vi.fn(),
  };
});

const mockEnv: ServiceEnv = {
  port: 8080,
  geminiApiKey: 'mock-key',
  vertex: undefined,
  allowedOrigins: [],
  schedulerToken: 'secret',
  schedulerServiceAccountEmail: 'scheduler@example.com',
  appToken: 'app-secret',
  dailyCapUsd: 10,
  captureBlocklist: []
};

describe('CloudDeckWorker', () => {
  let store: MemoryDataStore;
  let authAdapter: MockFirebaseAdapter;
  let tasksAdapter: MockTasksAdapter;
  let service: CloudDeckService;
  let worker: CloudDeckWorker;

  beforeEach(() => {
    store = new MemoryDataStore();
    authAdapter = new MockFirebaseAdapter();
    tasksAdapter = new MockTasksAdapter();
    service = new CloudDeckService(store, authAdapter, authAdapter, tasksAdapter);
    worker = new CloudDeckWorker(mockEnv, service);
    vi.clearAllMocks();
  });

  it('bails out if deck is not found', async () => {
    await worker.processDeckCreation({
      deckId: 'deck_missing',
      userId: 'user_pro',
      plan: { marketName: 'Test', vertical: 'Test', geography: null, notes: null, searchThemes: [] },
      query: 'Test'
    });
    expect(runLivingDeckEngine).not.toHaveBeenCalled();
  });

  it('fails safely if user entitlement is lost before starting', async () => {
    // create a deck for free user
    await service.saveDeck('user_free', 'deck_1', {
      deck: { id: 'deck_1' },
      market: { id: 'deck_1' },
      cards: [],
      plan: { marketName: 'Test', vertical: 'Test', geography: null, notes: null, searchThemes: [] },
      state: { status: 'running' }
    });

    await worker.processDeckCreation({
      deckId: 'deck_1',
      userId: 'user_free',
      plan: { marketName: 'Test', vertical: 'Test', geography: null, notes: null, searchThemes: [] },
      query: 'Test'
    });

    expect(runLivingDeckEngine).not.toHaveBeenCalled();
    const d = await service.getDeck('user_free', 'deck_1');
    expect(d?.state?.status).toBe('failed');
    expect(d?.state?.error).toBe('Entitlement lost');
  });

  it('runs engine and updates state to ready upon completion', async () => {
    await service.saveDeck('user_pro', 'deck_1', {
      deck: { id: 'deck_1' },
      market: { id: 'deck_1' },
      cards: [],
      plan: { marketName: 'Test', vertical: 'Test', geography: null, notes: null, searchThemes: [] },
      state: { status: 'running' }
    });

    const mockHydratedCards = [{
      cards: [{ card: { id: 'c1', title: 'Test Card' }, company: null, metrics: [], viceClaims: [] }]
    }];

    vi.mocked(runLivingDeckEngine).mockResolvedValueOnce({
      aborted: false,
      state: { status: 'settled' } as unknown as LivingDeckRun['state'],
      hydrated: mockHydratedCards as unknown as LivingDeckRun['hydrated'],
      topology: null,
      enrichmentFailures: [],
      watch: null,
      statuses: [],
      trace: [],
      summary: {} as unknown as LivingDeckRun['summary'],
      bootMs: 100,
      totalMs: 500
    });

    await worker.processDeckCreation({
      deckId: 'deck_1',
      userId: 'user_pro',
      plan: { marketName: 'Test', vertical: 'Test', geography: null, notes: null, searchThemes: [] },
      query: 'Test'
    });

    const d = await service.getDeck('user_pro', 'deck_1');
    expect(d?.state?.status).toBe('ready');
    expect(d?.cards.length).toBe(1);
    expect(d?.cards?.[0]?.card?.id).toBe('c1');
  });

  it('saves partial checkpoints on card events', async () => {
    await service.saveDeck('user_pro', 'deck_2', {
      deck: { id: 'deck_2' },
      market: { id: 'deck_2' },
      cards: [],
      plan: { marketName: 'Test', vertical: 'Test', geography: null, notes: null, searchThemes: [] },
      state: { status: 'running' }
    });

    vi.mocked(runLivingDeckEngine).mockImplementationOnce(async (options) => {
      // simulate card event
      if (options.onEvent) {
        options.onEvent({
          type: 'card',
          result: {
            cards: [{ card: { id: 'c1' }, company: null, metrics: [], viceClaims: [] }]
          } as unknown as HydrateCompanyCardResult
        });
        options.onEvent({
          type: 'card',
          result: {
            cards: [{ card: { id: 'c2' }, company: null, metrics: [], viceClaims: [] }]
          } as unknown as HydrateCompanyCardResult
        });
      }
      return {
        aborted: false,
        state: { status: 'settled' } as unknown as LivingDeckRun['state'],
        hydrated: [
          { cards: [{ card: { id: 'c1' }, company: null, metrics: [], viceClaims: [] }] },
          { cards: [{ card: { id: 'c2' }, company: null, metrics: [], viceClaims: [] }] }
        ] as unknown as LivingDeckRun['hydrated'],
        topology: null,
        enrichmentFailures: [],
        watch: null,
        statuses: [],
        trace: [],
        summary: {} as unknown as LivingDeckRun['summary'],
        bootMs: 100,
        totalMs: 500
      };
    });

    await worker.processDeckCreation({
      deckId: 'deck_2',
      userId: 'user_pro',
      plan: { marketName: 'Test', vertical: 'Test', geography: null, notes: null, searchThemes: [] },
      query: 'Test'
    });

    const d = await service.getDeck('user_pro', 'deck_2');
    expect(d?.state?.status).toBe('ready');
    expect(d?.cards.length).toBe(2);
  });

  it('persists a failed state when the research engine throws', async () => {
    await service.saveDeck('user_pro', 'deck_failed', {
      deck: { id: 'deck_failed' },
      market: { id: 'deck_failed' },
      cards: [],
      state: { status: 'running' },
    });
    vi.mocked(runLivingDeckEngine).mockRejectedValueOnce(new Error('model unavailable'));

    await worker.processDeckCreation({
      deckId: 'deck_failed',
      userId: 'user_pro',
      plan: { marketName: 'Test', vertical: 'Test', geography: null, notes: null, searchThemes: [] },
      query: 'Test',
    });

    const d = await service.getDeck('user_pro', 'deck_failed');
    expect(d?.state).toEqual({ status: 'failed', error: 'model unavailable' });
  });

  describe('Deck Refresh processing', () => {
    it('sets error and leaves deck ready if refresh fails', async () => {
      // Simulate entitlement lost during refresh
      await service.saveDeck('user_free', 'deck_3', { deck: { id: 'deck_3' }, market: {}, cards: [] });
      const worker = new CloudDeckWorker(mockEnv, service);
      await worker.processDeckRefresh({
        deckId: 'deck_3',
        userId: 'user_free',
        query: 'Testing Refresh'
      });
      const d = await service.getDeck('user_free', 'deck_3');
      expect(d?.state?.status).toBe('ready');
      expect(d?.state?.error).toBe('Entitlement lost');
    });
  });
});
