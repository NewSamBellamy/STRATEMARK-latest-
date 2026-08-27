import { describe, it, expect } from 'vitest';
import { createApp } from '../app';
import { readEnv } from '../env';

function app(over: NodeJS.ProcessEnv = {}) {
  return createApp(readEnv({ PORT: '8080', ...over }));
}

/** `Response.json()` is `unknown` under strict typing; tests state the shape. */
async function asJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

interface HealthBody {
  status: string;
  credentials: string;
  capabilities: { research: boolean; capture: boolean; pdf: boolean; scheduledRefresh: boolean };
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

  it('refuses honestly when nobody has supplied credentials', async () => {
    const res = await post(app(), '/v1/research', { query: 'vegan sneaker brands' });
    expect(res.status).toBe(503);
    expect((await asJson<ErrorBody>(res)).error).toMatch(/X-Gemini-Key/);
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

  it('rejects a caller without the token — this endpoint spends money', async () => {
    const res = await post(
      app({ GEMINI_API_KEY: 'k', SCHEDULER_TOKEN: 'secret' }),
      '/tasks/refresh',
      {},
    );
    expect(res.status).toBe(401);
  });

  it('rejects a wrong token', async () => {
    const res = await post(
      app({ GEMINI_API_KEY: 'k', SCHEDULER_TOKEN: 'secret' }),
      '/tasks/refresh',
      {},
      { 'x-scheduler-token': 'guess' },
    );
    expect(res.status).toBe(401);
  });

  it('accepts the configured token', async () => {
    const res = await post(
      app({ GEMINI_API_KEY: 'k', SCHEDULER_TOKEN: 'secret' }),
      '/tasks/refresh',
      {},
      { 'x-scheduler-token': 'secret' },
    );
    expect(res.status).toBe(200);
    expect((await asJson<RefreshBody>(res)).ok).toBe(true);
  });

  it('will not run a refresh with no credentials even when the token is right', async () => {
    const res = await post(
      app({ SCHEDULER_TOKEN: 'secret' }),
      '/tasks/refresh',
      {},
      { 'x-scheduler-token': 'secret' },
    );
    expect(res.status).toBe(503);
  });
});
