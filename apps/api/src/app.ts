/**
 * The Stratemark agent service.
 *
 * This is the server half of the product, and it exists for four reasons that
 * the browser build cannot satisfy on its own:
 *
 *   1. The agent graph runs on the official Google GenAI SDK here.
 *   2. Page capture needs a real browser, not a sandboxed one.
 *   3. Scheduled refresh needs something awake when nobody is looking.
 *   4. A PDF needs a print engine.
 *
 * Every route accepts an optional `X-Gemini-Key`. Supplying it means "use my
 * credentials" — the bring-your-own-key subscriber, who pays their own model
 * costs while we provide storage, sync and sharing. Omitting it means the
 * service's own credentials do the work. See lib/client.ts.
 */
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { describeAgentGraph, runLivingDeckEngine } from '@mi/research';
import type { MarketPlan } from '@mi/research';
import { hasServerCredentials, type ServiceEnv } from './env';
import { BYOK_HEADER, NoCredentialsError, resolveClient } from './lib/client';
import {
  APP_TOKEN_HEADER,
  authorizeSpend,
  callerKeyFor,
  RateLimiter,
  RateLimitedError,
  UnauthorizedSpendError,
} from './lib/authz';
import { BudgetExhaustedError, DailyBudget } from './lib/budget';
import { capturePage, CaptureError, type CaptureReceipt } from './lib/capture';
import { verifyCapture } from './lib/verify';
import { createVisionJudge } from './lib/vision';
import { fallbackCaption, renderFallbackCard } from './lib/fallback';
import { renderPdf } from './lib/pdf';
import { executeScheduledRefresh, type WorklistStore } from './lib/worklist';
import { createDataStore, type StratemarkDataStore } from './lib/firestoreStore';
import { CloudDeckService, FirebaseAdapter } from './lib/CloudDeckService';
import { CloudDeckWorker } from './lib/CloudDeckWorker';
import { CloudTasksAdapter, MockTasksAdapter, type TasksAdapter } from './lib/CloudTasksAdapter';

const planSchema = z.object({
  marketName: z.string().min(1),
  vertical: z.string().min(1),
  geography: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  searchThemes: z.array(z.string()).default([]),
});

const researchSchema = z.object({
  query: z.string().min(3).max(300).optional(),
  plan: planSchema.optional(),
  deckId: z.string().min(1).optional(),
  maxCandidates: z.number().int().min(1).max(24).optional(),
  watch: z.boolean().optional(),
});

const captureSchema = z.object({
  url: z.string().min(4),
  fullPage: z.boolean().optional(),
});

const pdfSchema = z.object({
  html: z.string().min(1),
  landscape: z.boolean().optional(),
  filename: z.string().max(120).optional(),
});

/** Turns a plain-language market question into a plan the graph can execute. */
async function planFromQuery(
  client: Awaited<ReturnType<typeof resolveClient>>['client'],
  query: string,
): Promise<MarketPlan> {
  const grounded = await client.ground(
    `Identify the market implied by this request: "${query}". ` +
      'Name the market, its vertical, and its geography if one is implied. ' +
      'Suggest four distinct angles worth searching to find the companies in it.',
  );
  return client.structure(
    `From this research, produce the market plan.\n\n${grounded.text}`,
    planSchema as unknown as z.ZodType<MarketPlan, z.ZodTypeDef, unknown>,
  );
}

/** Estimated cost of one full deck run — checked before work begins. */
const DECK_ESTIMATE_USD = 0.65;
/** Estimated cost of one capture with a vision adjudication. */
const CAPTURE_ESTIMATE_USD = 0.002;
/** Keep the asynchronous judging path inside the Cloud Run worker budget. */
const CLOUD_DEFAULT_MAX_CANDIDATES = 2;

export function createApp(
  env: ServiceEnv,
  options?: {
    store?: StratemarkDataStore;
    worklistStore?: WorklistStore;
    forceMemoryStore?: boolean;
    cloudDeckService?: CloudDeckService;
    tasksAdapter?: TasksAdapter;
  },
): Hono {
  const app = new Hono();
  const store = createDataStore(env, {
    store: options?.store,
    forceMemory: options?.forceMemoryStore,
  });

  const tasksAdapter = options?.tasksAdapter ?? (env.tasks ? new CloudTasksAdapter(env) : new MockTasksAdapter(env.port));
  const cloudDeckService = options?.cloudDeckService ?? new CloudDeckService(store, new FirebaseAdapter(), new FirebaseAdapter(), tasksAdapter);
  const cloudDeckWorker = new CloudDeckWorker(env, cloudDeckService);

  // Per-instance guards. See lib/budget.ts and lib/authz.ts for why these are
  // in memory and what that does and does not protect.
  const budget = new DailyBudget(env.dailyCapUsd);
  const researchLimiter = new RateLimiter(6, 60_000);
  const captureLimiter = new RateLimiter(20, 60_000);

  /** Maps our guard errors onto responses without leaking internals. */
  const guardError = (err: unknown): { status: 401 | 429; body: Record<string, unknown> } | null => {
    if (err instanceof UnauthorizedSpendError) return { status: 401, body: { error: err.message } };
    if (err instanceof RateLimitedError) return { status: 429, body: { error: err.message } };
    if (err instanceof BudgetExhaustedError) {
      return { status: 429, body: { error: err.message, budget: err.budget } };
    }
    return null;
  };

  const getUserId = async (c: Context): Promise<string | null> => {
    const auth = c.req.header('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (auth) {
      if (env.appToken && auth === env.appToken) return null;
      return await cloudDeckService.authenticate(auth);
    }
    return null;
  };

  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (env.allowedOrigins.length > 0 && origin) {
          return env.allowedOrigins.includes(origin) ? origin : env.allowedOrigins[0];
        }
        return origin || '*';
      },
      allowHeaders: [
        'Content-Type',
        'X-Gemini-Key',
        'X-Stratemark-Token',
        'x-scheduler-token',
        'Authorization',
        'authorization',
        'Accept',
      ],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PUT', 'PATCH'],
      credentials: true,
    }),
  );

  const healthHandler = (c: Context) =>
    c.json({
      status: 'ok',
      service: 'stratemark-agent-service',
      credentials: hasServerCredentials(env)
        ? env.vertex
          ? 'vertex-ai-adc'
          : 'gemini-api-key'
        : 'none — callers must supply X-Gemini-Key',
      capabilities: {
        research: true,
        capture: true,
        pdf: true,
        scheduledRefresh: Boolean(env.schedulerToken),
        /** False means callers must bring their own key to spend anything. */
        serverSpendEnabled: Boolean(env.appToken),
      },
      // Deliberately public: the remaining allowance is not a secret, and
      // surfacing it turns "why did research stop working" into one request.
      budget: budget.status(),
    });

  /**
   * Liveness plus an honest capability report. Cloud Run needs the former;
   * the latter turns "why does nothing work" into a single curl.
   */
  app.get('/healthz', healthHandler);
  app.get('/health', healthHandler);
  app.get('/', healthHandler);

  /**
   * The agent topology as data. Judges (and the UI) can see the graph without
   * running it or holding a credential.
   */
  app.get('/v1/agent-graph', (c) => c.json(describeAgentGraph({ watch: true })));

  /** User profile endpoint for Cloud Engine */
  app.get('/api/me', async (c) => {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    const isPro = await cloudDeckService.checkEntitlement(userId);
    return c.json({
      user: {
        id: userId,
        email: `${userId}@stratemark.com`, // placeholder
        subscriptionTier: isPro ? 'pro' : 'free',
        subscriptionStatus: 'active',
      },
    });
  });

  app.get('/api/alerts', (c) => c.json({ alerts: [] }));
  app.get('/api/markets', async (c) => {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    const markets = await cloudDeckService.getMarkets(userId);
    return c.json({ markets });
  });
  app.get('/api/markets/:id', async (c) => {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const m = await cloudDeckService.getMarket(userId, id);
    if (!m) return c.json({ error: 'Not found' }, 404);
    return c.json({ market: m });
  });
  app.get('/api/decks', async (c) => {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    const decks = await cloudDeckService.getDecks(userId);
    return c.json({ decks });
  });
  app.get('/api/decks/:deckId', async (c) => {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    const deckId = c.req.param('deckId');
    const d = await cloudDeckService.getDeck(userId, deckId);
    if (!d) return c.json({ error: 'Not found' }, 404);
    return c.json(d);
  });
  app.get('/api/cards', async (c) => {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    const deckId = c.req.query('deckId') || '';
    const d = deckId ? await cloudDeckService.getDeck(userId, deckId) : null;
    return c.json({ cards: d?.cards || [] });
  });
  app.get('/api/cards/saved', async (c) => {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    const cards = await cloudDeckService.getSavedCards(userId);
    return c.json({ cards });
  });
  app.post('/api/cards/saved', async (c) => {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    const body = await c.req.json().catch(() => ({}));
    if (!body.cardId) {
      return c.json({ error: 'cardId is required' }, 400);
    }
    await cloudDeckService.saveCard(userId, String(body.cardId), { 
      deckId: body.deckId, 
      deckRevision: body.deckRevision 
    });
    return c.json({ ok: true });
  });
  app.delete('/api/cards/saved/:cardId', async (c) => {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    const cardId = c.req.param('cardId');
    await cloudDeckService.unsaveCard(userId, cardId);
    return c.json({ ok: true });
  });
  app.delete('/api/decks/:deckId', async (c) => {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);
    const deckId = c.req.param('deckId');
    const success = await cloudDeckService.deleteDeck(userId, deckId);
    if (!success) return c.json({ error: 'Not found' }, 404);
    return c.json({ success: true });
  });

  /** Run the living-deck agent graph. */
  const researchHandler = async (c: Context) => {
    const json = await c.req.json().catch(() => ({}));
    const queryStr = (json.query || json.prompt || '').trim();
    const bodyData = {
      ...(queryStr ? { query: queryStr } : {}),
      ...(json.plan ? { plan: json.plan } : {}),
      ...(json.deckId ? { deckId: json.deckId } : {}),
      ...(json.maxCandidates || json.targetCompanies
        ? { maxCandidates: json.maxCandidates || json.targetCompanies }
        : {}),
      ...(json.watch !== undefined ? { watch: json.watch } : {}),
    };
    const body = researchSchema.safeParse(bodyData);
    if (!body.success) {
      return c.json({ error: 'Invalid request', detail: body.error.flatten() }, 400);
    }
    if (!body.data.query && !body.data.plan) {
      return c.json({ error: 'Provide either a query or a plan.' }, 400);
    }

    const callerKey = c.req.header(BYOK_HEADER);
    const rawAppToken = c.req.header(APP_TOKEN_HEADER);
    const authHeader = c.req.header('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const appToken = rawAppToken
      ? rawAppToken
      : authHeader && env.appToken && authHeader === env.appToken
        ? authHeader
        : undefined;

    const userId = await getUserId(c);

    let metered = false;
    try {
      const authz = authorizeSpend({ env, callerKey, appToken });
      
      // Cloud Deck creation (/api/research/deck or cloud persistence) requires verified user with entitlement
      const isCloudDeckEndpoint = c.req.path.startsWith('/api/research/deck');
      if (isCloudDeckEndpoint) {
        if (!userId) {
          throw new UnauthorizedSpendError('Authenticated user required for cloud research');
        }
        const isEntitled = await cloudDeckService.checkEntitlement(userId);
        if (!isEntitled) {
          throw new UnauthorizedSpendError('Active Pro entitlement required for cloud research');
        }
      } else if (!callerKey && userId) {
        const isEntitled = await cloudDeckService.checkEntitlement(userId);
        if (!isEntitled) {
          throw new UnauthorizedSpendError('Active Pro entitlement required for cloud research');
        }
      }

      metered = authz.metered;
      researchLimiter.check(callerKeyFor({ forwardedFor: c.req.header('x-forwarded-for'), appToken }));
      if (metered && !budget.canAfford(DECK_ESTIMATE_USD)) {
        throw new BudgetExhaustedError(budget.status());
      }
    } catch (err) {
      const mapped = guardError(err);
      if (mapped) return c.json(mapped.body, mapped.status);
      throw err;
    }

    const calls: Array<{ model: string; kind: string }> = [];
    let resolved;
    try {
      resolved = resolveClient({
        env,
        callerKey,
        onCall: (info) => {
          calls.push(info);
          if (metered) budget.record(info.kind === 'ground' ? 'ground' : 'structure');
        },
      });
    } catch (err) {
      if (err instanceof NoCredentialsError) return c.json({ error: err.message }, 503);
      throw err;
    }

    const plan = body.data.plan ?? (await planFromQuery(resolved.client, body.data.query ?? ''));
    const deckId = body.data.deckId ?? `deck_${Date.now().toString(36)}`;

    // If it's a cloud generation request, enqueue it asynchronously
    if (!callerKey && userId) {
      await cloudDeckService.enqueueCreation({
        deckId,
        userId,
         plan,
         query: body.data.query ?? '',
         maxCandidates: body.data.maxCandidates ?? CLOUD_DEFAULT_MAX_CANDIDATES,
         watch: body.data.watch,
       });

      return c.json({
        ok: true,
        deckId,
        plan,
        state: { status: 'running' },
      }, 202);
    }

    // BYOK users execute synchronously without cloud persistence
    const run = await runLivingDeckEngine({
      client: resolved.client,
      plan,
      deckId,
      watch: body.data.watch ?? false,
      ...(body.data.maxCandidates === undefined ? {} : { maxCandidates: body.data.maxCandidates }),
      signal: AbortSignal.timeout(540_000),
    });

    const marketObj = {
      id: deckId,
      marketId: deckId,
      name: plan.marketName,
      scopeDefinition: { vertical: plan.vertical, geography: plan.geography, notes: plan.notes },
      refreshCadence: 'weekly',
      createdAt: new Date().toISOString(),
      engine: 'cloud',
    };
    const deckObj = {
      id: deckId,
      marketId: deckId,
      createdAt: new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
      engine: 'cloud',
    };
    // Removed cloudDeckService.saveDeck here because it's only synchronous BYOK runs now.

    return c.json({
      ok: true,
      deckId,
      plan,
      market: marketObj,
      deck: deckObj,
      cards: run.hydrated,
      state: run.state,
      statuses: run.statuses,
      summary: run.summary,
      timings: { bootMs: run.bootMs, totalMs: run.totalMs },
      aborted: run.aborted,
      billing: {
        keySource: resolved.keySource,
        calls: calls.length,
        metered,
        ...(metered ? { budget: budget.status() } : {}),
      },
    });
  };

  app.post('/v1/research', researchHandler);
  app.post('/api/research/deck', researchHandler);

  /**
   * Capture a page, verify the capture is genuine, and never return a
   * screenshot we cannot vouch for.
   */
  app.post('/v1/capture', async (c) => {
    const body = captureSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: 'Invalid request', detail: body.error.flatten() }, 400);
    }

    const appToken = c.req.header(APP_TOKEN_HEADER);
    const callerKey = c.req.header(BYOK_HEADER);

    // Capture needs no spend authorisation — it is the visible product feature
    // and costs us CPU, not tokens. It IS rate limited, because launching
    // Chromium is expensive enough to be a denial-of-service lever.
    try {
      captureLimiter.check(callerKeyFor({ forwardedFor: c.req.header('x-forwarded-for'), appToken }));
    } catch (err) {
      const mapped = guardError(err);
      if (mapped) return c.json(mapped.body, mapped.status);
      throw err;
    }

    let receipt: CaptureReceipt;
    let screenshot: Buffer;
    let text: string;
    try {
      const shot = await capturePage({
        url: body.data.url,
        blocklist: env.captureBlocklist,
        ...(body.data.fullPage === undefined ? {} : { fullPage: body.data.fullPage }),
      });
      receipt = shot.receipt;
      screenshot = shot.screenshot;
      text = shot.text;
    } catch (err) {
      if (err instanceof CaptureError) return c.json({ error: err.message }, err.status as 400);
      throw err;
    }

    // The vision adjudication DOES cost tokens, so it is authorised and metered
    // like research. Without authorisation it is simply skipped, and
    // verifyCapture fails closed — an unverified capture is never reported as
    // genuine just because we could not afford to check it.
    let visionAllowed = false;
    let visionMetered = false;
    try {
      const authz = authorizeSpend({ env, callerKey, appToken });
      visionMetered = authz.metered;
      visionAllowed = !visionMetered || budget.canAfford(CAPTURE_ESTIMATE_USD);
    } catch {
      visionAllowed = false;
    }

    const verdict = await verifyCapture({
      receipt,
      text,
      screenshot,
      ...(() => {
        if (!visionAllowed) return {};
        const judge = createVisionJudge({ env, callerKey });
        if (!judge) return {};
        return {
          vision: async (input: { screenshot: Buffer; prompt: string }) => {
            if (visionMetered) budget.record('vision');
            return judge(input);
          },
        };
      })(),
    });

    if (verdict.isRealPage) {
      return c.json({
        ok: true,
        receipt,
        verdict,
        screenshot: `data:image/png;base64,${screenshot.toString('base64')}`,
      });
    }

    // Blocked. Return the receipt as evidence of the visit and a generated
    // card in place of the image — never the block page dressed up as content.
    return c.json({
      ok: false,
      receipt,
      verdict,
      fallbackSvg: renderFallbackCard({ receipt, verdict }),
      caption: fallbackCaption(verdict),
    });
  });

  /** Render a self-contained HTML report as a real PDF. */
  app.post('/v1/report/pdf', async (c) => {
    const body = pdfSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: 'Invalid request', detail: body.error.flatten() }, 400);
    }
    const pdf = await renderPdf({
      html: body.data.html,
      ...(body.data.landscape === undefined ? {} : { landscape: body.data.landscape }),
    });
    const name = (body.data.filename ?? 'stratemark-report').replace(/[^a-zA-Z0-9._-]/g, '-');
    return c.body(new Uint8Array(pdf), 200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}.pdf"`,
    });
  });

  const verifyWorkerOidc = (c: Context): boolean => {
    if (!env.tasks?.serviceAccountEmail) return true;
    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return false;
    }
    try {
      const token = authHeader.split(' ')[1];
      if (!token) return false;
      const parts = token.split('.');
      if (parts.length < 2) return false;
      const payloadBase64 = parts[1];
      if (!payloadBase64) return false;
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);
      return payload.email === env.tasks.serviceAccountEmail;
    } catch {
      return false;
    }
  };

  /**
   * Cloud Tasks worker endpoint for async deck creation.
   * Assumes OIDC validation is handled by Cloud Run IAM proxy in production.
   * We do basic sanity checks here.
   */
  app.post('/tasks/worker/research', async (c) => {
    if (!verifyWorkerOidc(c)) {
      return c.json({ error: 'Unauthorized: Invalid service account OIDC token' }, 401);
    }

    // Cloud Tasks sets specific headers we can verify to ensure it was routed by the task queue
    // In local development or testing, these might be absent depending on adapter, so we just log.
    const queueName = c.req.header('X-CloudTasks-QueueName');
    if (env.tasks && !queueName) {
       console.warn('Worker invoked without X-CloudTasks-QueueName header - ensure IAM proxy is securing this endpoint.');
    }
    
    const payload = await c.req.json().catch(() => null);
    if (!payload || !payload.deckId || !payload.userId || !payload.plan) {
      return c.json({ error: 'Invalid task payload' }, 400);
    }
    
    // Process deck creation
    await cloudDeckWorker.processDeckCreation(payload);
    
    return c.json({ ok: true });
  });

  app.post('/tasks/worker/refresh', async (c) => {
    if (!verifyWorkerOidc(c)) {
      return c.json({ error: 'Unauthorized: Invalid service account OIDC token' }, 401);
    }

    const queueName = c.req.header('X-CloudTasks-QueueName');
    if (env.tasks && !queueName) {
       console.warn('Worker invoked without X-CloudTasks-QueueName header - ensure IAM proxy is securing this endpoint.');
    }
    
    const payload = await c.req.json().catch(() => null);
    if (!payload || !payload.deckId || !payload.userId || !payload.query) {
      return c.json({ error: 'Invalid task payload for refresh' }, 400);
    }
    
    await cloudDeckWorker.processDeckRefresh(payload);
    
    return c.json({ ok: true });
  });

  /**
   * Cloud Scheduler target. Guarded by OIDC: Cloud Run IAM validates the signature,
   * we just decode the JWT to verify the service account email.
   */
  app.post('/tasks/refresh', async (c) => {
    if (!env.schedulerServiceAccountEmail) {
      return c.json({ error: 'Scheduled refresh is not configured with an OIDC service account.' }, 503);
    }
    
    const authHeader = c.req.header('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return c.json({ error: 'Unauthorized: Missing or invalid Bearer token' }, 401);
    }

    try {
      const token = authHeader.split(' ')[1];
      if (!token) throw new Error('Missing token');
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) throw new Error('Missing payload');
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);
      
      if (payload.email !== env.schedulerServiceAccountEmail) {
         return c.json({ error: 'Unauthorized: Invalid service account' }, 401);
      }
    } catch {
      return c.json({ error: 'Unauthorized: Malformed token' }, 401);
    }

    if (!hasServerCredentials(env)) {
      return c.json({ error: 'No server credentials; nothing to refresh with.' }, 503);
    }
    
    // We don't resolve the LlmClient directly anymore in the scheduler since
    // executeScheduledRefresh fan-out logic now delegates to workers.
    
    const result = await executeScheduledRefresh({
      env,
      store: options?.worklistStore ?? store,
      cloudDeckService,
      tasksAdapter,
    });

    return c.json(result);
  });

  app.onError((err, c) => {
    // Never leak internals to the caller; the detail goes to Cloud Logging.
    console.error(JSON.stringify({ severity: 'ERROR', message: err.message, stack: err.stack }));
    const status = (err as Error & { status?: unknown }).status;
    if (status === 429) {
      return c.json({ error: 'Cloud model quota is exhausted. Try again later or provide your own Gemini key.' }, 429);
    }
    if (status === 404 || err.message === 'Not found') {
      return c.json({ error: 'Not found' }, 404);
    }
    if (err.message?.includes('model') && err.message?.includes('unavailable')) {
      return c.json({ error: 'The configured cloud model is unavailable in this region.' }, 503);
    }
    return c.json({ error: 'Internal error' }, 500);
  });

  return app;
}
