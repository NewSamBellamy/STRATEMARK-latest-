import { describe, it, expect, vi } from 'vitest';
import {
  executeScheduledRefresh,
  type WorklistStore,
  type RefreshWorklistDeck,
} from '../lib/worklist';
import type { ServiceEnv } from '../env';
import type { CloudDeckService } from '../lib/CloudDeckService';
import type { TasksAdapter } from '../lib/CloudTasksAdapter';

const mockEnv: ServiceEnv = {
  port: 8080,
  geminiApiKey: 'k',
  vertex: undefined,
  allowedOrigins: [],
  schedulerToken: 'secret',
  appToken: undefined,
  dailyCapUsd: 10,
  captureBlocklist: [],
};

describe('executeScheduledRefresh', () => {
  it('returns unconfigured note when no store is available', async () => {
    const res = await executeScheduledRefresh({
      env: mockEnv,
    });
    expect(res.ok).toBe(true);
    expect(res.refreshed).toBe(0);
    expect(res.note).toMatch(/No persistence layer bound/);
  });

  it('enqueues refresh tasks for eligible decks', async () => {
    const decks: RefreshWorklistDeck[] = [
      { deckId: 'd1', userId: 'user1', query: 'Frontier AI', cards: [] },
    ];
    
    const mockStore: WorklistStore = {
      async getDecks() {
        return decks;
      },
      saveRefreshedDeck: vi.fn(),
    };

    const mockCloudDeckService = {
      checkEntitlement: vi.fn(async () => true),
      getDeck: vi.fn(async () => ({ cards: [] })),
      saveDeck: vi.fn(async () => {}),
    } as unknown as CloudDeckService;

    const mockTasksAdapter = {
      enqueueDeckRefresh: vi.fn(async () => {}),
    } as unknown as TasksAdapter;

    const res = await executeScheduledRefresh({
      env: mockEnv,
      store: mockStore,
      cloudDeckService: mockCloudDeckService,
      tasksAdapter: mockTasksAdapter,
    });

    expect(res.ok).toBe(true);
    expect(res.refreshed).toBe(1);
    expect(res.totalDecks).toBe(1);
    expect(mockTasksAdapter.enqueueDeckRefresh).toHaveBeenCalledWith({
      deckId: 'd1',
      userId: 'user1',
      query: 'Frontier AI'
    });
    expect(mockCloudDeckService.saveDeck).toHaveBeenCalledWith('user1', 'd1', expect.objectContaining({
      state: { status: 'refreshing' }
    }));
  });
});
