import { describe, it, expect, vi } from 'vitest';
import type { LlmClient } from '@mi/research';
import {
  executeScheduledRefresh,
  type WorklistStore,
  type RefreshWorklistDeck,
} from '../lib/worklist';
import type { ServiceEnv } from '../env';

function stubClient(): LlmClient {
  return {
    async ground() {
      return { text: 'ok', citations: [], queries: [] };
    },
    async structure<T>() {
      return { companies: [] } as T;
    },
  };
}

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
      client: stubClient(),
      env: mockEnv,
    });
    expect(res.ok).toBe(true);
    expect(res.refreshed).toBe(0);
    expect(res.note).toMatch(/No persistence layer bound/);
  });

  it('runs refresh loop over store decks and saves updated cards', async () => {
    const decks: RefreshWorklistDeck[] = [
      { deckId: 'd1', query: 'Frontier AI', cards: [] },
    ];
    const saveRefreshedDeck = vi.fn(async () => undefined);
    const mockStore: WorklistStore = {
      async getDecks() {
        return decks;
      },
      saveRefreshedDeck,
    };

    const res = await executeScheduledRefresh({
      client: stubClient(),
      env: mockEnv,
      store: mockStore,
    });

    expect(res.ok).toBe(true);
    expect(res.refreshed).toBe(1);
    expect(res.totalDecks).toBe(1);
    expect(saveRefreshedDeck).toHaveBeenCalledWith('d1', expect.objectContaining({
      refreshedAt: expect.any(String),
      cards: expect.any(Array),
    }));
  });
});
