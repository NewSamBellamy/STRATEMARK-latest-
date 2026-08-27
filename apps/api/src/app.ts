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
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { describeAgentGraph, runLivingDeckEngine } from '@mi/research';
import type { MarketPlan } from '@mi/research';
import { hasServerCredentials, type ServiceEnv } from './env';
import { BYOK_HEADER, NoCredentialsError, resolveClient } from './lib/client';
import { capturePage, CaptureError, type CaptureReceipt } from './lib/capture';
import { verifyCapture } from './lib/verify';
import { createVisionJudge } from './lib/vision';
import { fallbackCaption, renderFallbackCard } from './lib/fallback';
import { renderPdf } from './lib/pdf';

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

export function createApp(env: ServiceEnv): Hono {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: env.allowedOrigins.length > 0 ? env.allowedOrigins : [],
      allowHeaders: ['Content-Type', 'X-Gemini-Key'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    }),
  );

  /**
   * Liveness plus an honest capability report. Cloud Run needs the former;
   * the latter turns "why does nothing work" into a single curl.
   */
  app.get('/healthz', (c) =>
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
      },
    }),
  );

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

    const calls: Array<{ model: string; kind: string }> = [];
    let resolved;
    try {
      resolved = resolveClient({
        env,
        callerKey: c.req.header(BYOK_HEADER),
        onCall: (info) => calls.push(info),
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
      billing: { keySource: resolved.keySource, calls: calls.length },
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

    const callerKey = c.req.header(BYOK_HEADER);
    const verdict = await verifyCapture({
      receipt,
      text,
      screenshot,
      ...(() => {
        const vision = createVisionJudge({ env, callerKey });
        return vision ? { vision } : {};
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
    // The refresh worklist lives in Firestore, which is Maruf's step to wire.
    // Until then this reports honestly rather than pretending to have run.
    return c.json({
      ok: true,
      ranAt: new Date().toISOString(),
      refreshed: 0,
      note: 'No persistence layer bound yet — connect Firestore to populate the refresh worklist.',
    });
  });

  app.onError((err, c) => {
    // Never leak internals to the caller; the detail goes to Cloud Logging.
    console.error(JSON.stringify({ severity: 'ERROR', message: err.message, stack: err.stack }));
    return c.json({ error: 'Internal error' }, 500);
  });

  return app;
}
