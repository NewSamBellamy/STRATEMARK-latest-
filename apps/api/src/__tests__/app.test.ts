import { describe, it, expect } from 'vitest';
import { createApp } from '../app';
import { readEnv } from '../env';
import { CloudDeckService, MockFirebaseAdapter } from '../lib/CloudDeckService';
import { MemoryDataStore } from '../lib/firestoreStore';
import { MockTasksAdapter } from '../lib/CloudTasksAdapter';

function app(over: NodeJS.ProcessEnv = {}, tasksAdapter?: MockTasksAdapter) {
  const store = new MemoryDataStore();
  const mockAuth = new MockFirebaseAdapter();
  const cloudDeckService = new CloudDeckService(store, mockAuth, mockAuth, tasksAdapter);
  return createApp(readEnv({ PORT: '8080', ...over }), {
    store,
    cloudDeckService,
    forceMemoryStore: true,
    ...(tasksAdapter ? { tasksAdapter } : {}),
  });
}

/** `Response.json()` is `unknown` under strict typing; tests state the shape. */
async function asJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface HealthBody {
  status: string;
  credentials: string;
  capabilities: {
    research: boolean;
    capture: boolean;
    pdf: boolean;
    scheduledRefresh: boolean;
    serverSpendEnabled: boolean;
  };
  budget: { capUsd: number; spentUsd: number; remainingUsd: number; exhausted: boolean };
}
interface ErrorBody {
  error: string;
}
interface RefreshBody {
  ok: boolean;
}

async function post(
  a: ReturnType<typeof app>,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return a.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('GET /healthz', () => {
  it('answers even with no credentials, and says so', async () => {
    const res = await app().request('/healthz');
    expect(res.status).toBe(200);
    const body = await asJson<HealthBody>(res);
    expect(body.status).toBe('ok');
    // A container that reports its own missing config turns a support ticket
    // into a single curl.
    expect(body.credentials).toMatch(/none/);
  });

  it('reports which credential mode is active', async () => {
    const withKey = await asJson<HealthBody>(await app({ GEMINI_API_KEY: 'k' }).request('/healthz'));
    expect(withKey.credentials).toBe('gemini-api-key');

    const withVertex = await asJson<HealthBody>(
      await app({ USE_VERTEX_AI: 'true', GOOGLE_CLOUD_PROJECT: 'p' }).request('/healthz'),
    );
    expect(withVertex.credentials).toBe('vertex-ai-adc');
  });

  it('reports scheduled refresh as unavailable until a token is configured', async () => {
    const off = await asJson<HealthBody>(await app().request('/healthz'));
    expect(off.capabilities.scheduledRefresh).toBe(false);

    const on = await asJson<HealthBody>(await app({ SCHEDULER_TOKEN: 't' }).request('/healthz'));
    expect(on.capabilities.scheduledRefresh).toBe(true);
  });

  it('reports whether anyone may spend the service credentials', async () => {
    const closed = await asJson<HealthBody>(await app({ GEMINI_API_KEY: 'k' }).request('/healthz'));
    expect(closed.capabilities.serverSpendEnabled).toBe(false);

    const open = await asJson<HealthBody>(
      await app({ GEMINI_API_KEY: 'k', APP_TOKEN: 't' }).request('/healthz'),
    );
    expect(open.capabilities.serverSpendEnabled).toBe(true);
  });

  it('publishes the remaining allowance so an exhausted budget is diagnosable', async () => {
    const body = await asJson<HealthBody>(
      await app({ GEMINI_API_KEY: 'k', DAILY_CAP_USD: '7.5' }).request('/healthz'),
    );
    expect(body.budget.capUsd).toBe(7.5);
    expect(body.budget.spentUsd).toBe(0);
    expect(body.budget.exhausted).toBe(false);
  });
});

describe('GET /v1/agent-graph', () => {
  it('exposes the agent topology without needing a credential', async () => {
    const res = await app().request('/v1/agent-graph');
    expect(res.status).toBe(200);
    const graph = await asJson<unknown>(res);
    expect(graph).toBeTruthy();
    expect(JSON.stringify(graph).length).toBeGreaterThan(50);
  });
});

describe('POST /v1/research', () => {
  it('rejects a body with neither a query nor a plan', async () => {
    const res = await post(app({ GEMINI_API_KEY: 'k' }), '/v1/research', {});
    expect(res.status).toBe(400);
    expect((await asJson<ErrorBody>(res)).error).toMatch(/query or a plan/);
  });

  it('rejects a malformed body before touching a model', async () => {
    const res = await post(app({ GEMINI_API_KEY: 'k' }), '/v1/research', { query: 'x' });
    expect(res.status).toBe(400);
  });

  it('refuses to spend without authorisation, before reaching credentials', async () => {
    // 401 rather than 503: the question "who is paying for this" is answered
    // before the question "do we have a key". An open endpoint attached to a
    // billing account is the failure mode this prevents.
    const res = await post(app({ GEMINI_API_KEY: 'k' }), '/v1/research', {
      query: 'vegan sneaker brands',
    });
    expect(res.status).toBe(401);
    const body = await asJson<ErrorBody>(res);
    expect(body.error).toMatch(/X-Gemini-Key/);
    expect(body.error).toMatch(/X-Stratemark-Token/);
  });

  it('refuses an invalid app token', async () => {
    const res = await post(
      app({ GEMINI_API_KEY: 'k', APP_TOKEN: 'right' }),
      '/v1/research',
      { query: 'vegan sneaker brands' },
      { 'x-stratemark-token': 'wrong' },
    );
    expect(res.status).toBe(401);
  });

  it('refuses when the daily allowance cannot cover a deck', async () => {
    // Cap below the cost of one deck: the request must be turned away up front
    // rather than producing half a deck and a bill.
    const res = await post(
      app({ GEMINI_API_KEY: 'k', APP_TOKEN: 'tok', DAILY_CAP_USD: '0.01' }),
      '/v1/research',
      { query: 'vegan sneaker brands' },
      { 'x-stratemark-token': 'tok' },
    );
    expect(res.status).toBe(429);
    expect((await asJson<ErrorBody>(res)).error).toMatch(/daily spending limit/);
  });

  it('rate limits a caller hammering research', async () => {
    const a = app({ GEMINI_API_KEY: 'k', APP_TOKEN: 'tok', DAILY_CAP_USD: '0.01' });
    const hit = () =>
      post(a, '/v1/research', { query: 'vegan sneaker brands' }, {
        'x-stratemark-token': 'tok',
        'x-forwarded-for': '203.0.113.7',
      });
    // Limit is 6/minute; the budget refusal at 429 does not consume authorisation,
    // so the seventh must be refused by the limiter rather than reaching work.
    for (let i = 0; i < 6; i += 1) await hit();
    const res = await hit();
    expect(res.status).toBe(429);
    expect((await asJson<ErrorBody>(res)).error).toMatch(/Too many requests/);
  });

  it('persists and returns the exact cloud deck identity for a supplied plan', async () => {
    const tasks = new MockTasksAdapter();
    const a = app({ GEMINI_API_KEY: 'k', APP_TOKEN: 't' }, tasks);
    const res = await post(
      a,
      '/api/research/deck',
      {
        deckId: 'deck_exact_identity',
        plan: { marketName: 'Test', vertical: 'Test', geography: null, notes: null, searchThemes: [] },
      },
      { Authorization: 'Bearer valid_token', 'X-Stratemark-Token': 't' },
    );

    expect(res.status).toBe(202);
    expect((await asJson<{ deckId: string; state: { status: string } }>(res))).toMatchObject({
      deckId: 'deck_exact_identity',
      state: { status: 'running' },
    });
    expect(tasks.queuedTasks[0]?.maxCandidates).toBe(2);
    const deck = await a.request('/api/decks/deck_exact_identity', {
      headers: { Authorization: 'Bearer valid_token' },
    });
    expect(deck.status).toBe(200);
  });
});

describe('POST /v1/capture', () => {
  it('refuses the cloud metadata server', async () => {
    const res = await post(app({ GEMINI_API_KEY: 'k' }), '/v1/capture', {
      url: 'http://169.254.169.254/computeMetadata/v1/',
    });
    expect(res.status).toBe(403);
  });

  it('refuses a non-http scheme', async () => {
    const res = await post(app({ GEMINI_API_KEY: 'k' }), '/v1/capture', {
      url: 'file:///etc/passwd',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a missing url', async () => {
    expect((await post(app(), '/v1/capture', {})).status).toBe(400);
  });
});

describe('POST /v1/report/pdf', () => {
  it('rejects an empty document', async () => {
    expect((await post(app(), '/v1/report/pdf', { html: '' })).status).toBe(400);
  });
});

describe('POST /tasks/refresh', () => {
  it('is unavailable until a scheduler token is configured', async () => {
    expect((await post(app({ GEMINI_API_KEY: 'k' }), '/tasks/refresh', {})).status).toBe(503);
  });

  const MOCK_TOKEN = `header.${Buffer.from(JSON.stringify({ email: 'scheduler@example.com' })).toString('base64')}.sig`;
  const MOCK_WRONG_TOKEN = `header.${Buffer.from(JSON.stringify({ email: 'hacker@example.com' })).toString('base64')}.sig`;

  it('rejects a caller without the token — this endpoint spends money', async () => {
    const res = await post(
      app({ GEMINI_API_KEY: 'k', SCHEDULER_SERVICE_ACCOUNT_EMAIL: 'scheduler@example.com' }),
      '/tasks/refresh',
      {},
    );
    expect(res.status).toBe(401);
  });

  it('rejects a wrong token', async () => {
    const res = await post(
      app({ GEMINI_API_KEY: 'k', SCHEDULER_SERVICE_ACCOUNT_EMAIL: 'scheduler@example.com' }),
      '/tasks/refresh',
      {},
      { 'authorization': `Bearer ${MOCK_WRONG_TOKEN}` },
    );
    expect(res.status).toBe(401);
  });

  it('accepts the configured token', async () => {
    const res = await post(
      app({ GEMINI_API_KEY: 'k', SCHEDULER_SERVICE_ACCOUNT_EMAIL: 'scheduler@example.com' }),
      '/tasks/refresh',
      {},
      { 'authorization': `Bearer ${MOCK_TOKEN}` },
    );
    expect(res.status).toBe(200);
    expect((await asJson<RefreshBody>(res)).ok).toBe(true);
  });

  it('will not run a refresh with no credentials even when the token is right', async () => {
    const res = await post(
      app({ SCHEDULER_SERVICE_ACCOUNT_EMAIL: 'scheduler@example.com' }),
      '/tasks/refresh',
      {},
      { 'authorization': `Bearer ${MOCK_TOKEN}` },
    );
    expect(res.status).toBe(503);
  });
});

describe('REST Persistence API Endpoints', () => {
  it('serves /api/me user profile', async () => {
    const res = await app().request('/api/me', {
      headers: { Authorization: 'Bearer valid_token' },
    });
    expect(res.status).toBe(200);
    const body = await asJson<{ user: { id: string; subscriptionTier: string } }>(res);
    expect(body.user.id).toBe('user_123');
    expect(body.user.subscriptionTier).toBe('pro');
  });

  it('handles saved cards CRUD', async () => {
    const a = app();
    const headers = { Authorization: 'Bearer valid_token' };

    // Initially empty
    const list1 = await a.request('/api/cards/saved', { headers });
    expect(list1.status).toBe(200);
    expect((await asJson<{ cards: Array<Record<string, unknown>> }>(list1)).cards).toEqual([]);

    // Save a card
    const saveRes = await post(a, '/api/cards/saved', { cardId: 'card_xyz', title: 'Top AI Co' }, headers);
    expect(saveRes.status).toBe(200);

    // List again
    const list2 = await a.request('/api/cards/saved', { headers });
    const cards2 = (await asJson<{ cards: Array<{ cardId: string }> }>(list2)).cards;
    expect(cards2.length).toBe(1);
    expect(cards2[0]?.cardId).toBe('card_xyz');

    // Unsave card
    const deleteRes = await a.request('/api/cards/saved/card_xyz', { method: 'DELETE', headers });
    expect(deleteRes.status).toBe(200);

    // List after deletion
    const list3 = await a.request('/api/cards/saved', { headers });
    expect((await asJson<{ cards: Array<Record<string, unknown>> }>(list3)).cards.length).toBe(0);
  });

  it('manages markets and decks listing', async () => {
    const a = app();
    const marketsRes = await a.request('/api/markets', { headers: { Authorization: 'Bearer valid_token' } });
    expect(marketsRes.status).toBe(200);
    const decksRes = await a.request('/api/decks', { headers: { Authorization: 'Bearer valid_token' } });
    expect(decksRes.status).toBe(200);
  });
});
