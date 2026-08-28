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

export function createApp(env: ServiceEnv, options?: { worklistStore?: WorklistStore }): Hono {
  const app = new Hono();

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

  app.use(
    '*',
    cors({
      origin: env.allowedOrigins.length > 0 ? env.allowedOrigins : '*',
      allowHeaders: ['Content-Type', 'X-Gemini-Key', 'X-Stratemark-Token', 'x-scheduler-token'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
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

  /** Run the living-deck agent graph. */
  app.post('/v1/research', async (c) => {
    const body = researchSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: 'Invalid request', detail: body.error.flatten() }, 400);
    }
    if (!body.data.query && !body.data.plan) {
      return c.json({ error: 'Provide either a query or a plan.' }, 400);
    }

    const callerKey = c.req.header(BYOK_HEADER);
    const appToken = c.req.header(APP_TOKEN_HEADER);

    // Authorise and meter BEFORE any model work starts. A deck is ~27 requests;
    // discovering the cap halfway through leaves the caller with a half-built
    // deck and us holding the bill for it.
    let metered = false;
    try {
      const authz = authorizeSpend({ env, callerKey, appToken });
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
          // Only spend on OUR credentials counts against the allowance.
          if (metered) budget.record(info.kind === 'ground' ? 'ground' : 'structure');
        },
      });
    } catch (err) {
      if (err instanceof NoCredentialsError) return c.json({ error: err.message }, 503);
      throw err;
    }

    const plan = body.data.plan ?? (await planFromQuery(resolved.client, body.data.query ?? ''));
    const deckId = body.data.deckId ?? `deck_${Date.now().toString(36)}`;

    const run = await runLivingDeckEngine({
      client: resolved.client,
      plan,
      deckId,
      watch: body.data.watch ?? false,
      ...(body.data.maxCandidates === undefined ? {} : { maxCandidates: body.data.maxCandidates }),
      signal: AbortSignal.timeout(540_000),
    });

    return c.json({
      deckId,
      plan,
      state: run.state,
      statuses: run.statuses,
      summary: run.summary,
      timings: { bootMs: run.bootMs, totalMs: run.totalMs },
      aborted: run.aborted,
      // Cost attribution, so the meter can charge the right party.
      billing: {
        keySource: resolved.keySource,
        calls: calls.length,
        metered,
        ...(metered ? { budget: budget.status() } : {}),
      },
    });
  });

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

  /**
   * Cloud Scheduler target. Guarded by a shared secret: without it this is an
   * open endpoint that spends money on demand for anyone who finds the URL.
   */
  app.post('/tasks/refresh', async (c) => {
    if (!env.schedulerToken) {
      return c.json({ error: 'Scheduled refresh is not configured.' }, 503);
    }
    if (c.req.header('x-scheduler-token') !== env.schedulerToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    if (!hasServerCredentials(env)) {
      return c.json({ error: 'No server credentials; nothing to refresh with.' }, 503);
    }
    let resolved;
    try {
      resolved = resolveClient({ env });
    } catch (err) {
      if (err instanceof NoCredentialsError) return c.json({ error: err.message }, 503);
      throw err;
    }

    const result = await executeScheduledRefresh({
      client: resolved.client,
      env,
      store: options?.worklistStore,
    });

    return c.json(result);
  });

  app.onError((err, c) => {
    // Never leak internals to the caller; the detail goes to Cloud Logging.
    console.error(JSON.stringify({ severity: 'ERROR', message: err.message, stack: err.stack }));
    return c.json({ error: 'Internal error' }, 500);
  });

  return app;
}
