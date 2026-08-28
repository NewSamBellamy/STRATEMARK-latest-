/**
 * Gemini client built on the OFFICIAL Google GenAI SDK (`@google/genai`).
 *
 * This is a second implementation of the same `LlmClient` contract that
 * `gemini.ts` satisfies with raw fetch. Both are kept on purpose:
 *
 *   gemini.ts  — zero-dependency fetch. Runs in the BROWSER and in Electron,
 *                where the user's own key does the work (BYOK). Shipping a
 *                Node-oriented SDK into the web bundle would cost size for no
 *                gain, and the raw call is the honest minimum there.
 *   genai.ts   — the official SDK. Runs SERVER-SIDE (Cloud Run), where the
 *                subscription tier's shared key or Vertex AI application
 *                default credentials do the work.
 *
 * Because `LivingDeckEngine` and `runAdkTaskGraph` depend only on `LlmClient`,
 * swapping this in moves the ENTIRE existing agent pipeline onto the Google
 * SDK without touching a line of orchestration logic.
 *
 * Two credential modes:
 *   - `apiKey`  — Gemini Developer API. Simplest; what BYOK subscribers use.
 *   - `vertex`  — Vertex AI with application default credentials. On Cloud Run
 *                 this means the service account, so no key exists to leak.
 */
import type { ZodType, ZodTypeDef } from 'zod';
import { GoogleGenAI } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';
import type { Citation, LlmClient } from './types';
import { createRateLimiter, extractJson, withRetry, type RetryableError } from './util';
import {
  DEFAULT_GROUNDED_MODEL,
  DEFAULT_GROUNDED_RPM,
  DEFAULT_STRUCTURE_MODEL,
  DEFAULT_STRUCTURE_RPM,
} from './gemini';

export interface GenAiUsage {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
}

export interface GenAiClientConfig {
  /** Gemini Developer API key. Omit when using `vertex`. */
  apiKey?: string;
  /**
   * Vertex AI mode — authenticates with application default credentials
   * instead of a key. On Cloud Run that is the attached service account.
   */
  vertex?: { project: string; location: string };
  /** Grounded model — must support Google Search grounding. */
  model?: string;
  /** Structuring model (non-grounded JSON). */
  structureModel?: string;
  /** Proactive pacing per model line. Set 0 to disable (tests). */
  groundedRpm?: number;
  structureRpm?: number;
  /** Observability hook — fires once per outbound request. Powers cost metering. */
  onCall?: (info: {
    model: string;
    kind: 'ground' | 'structure';
    usage?: GenAiUsage;
  }) => void;
  /** Injectable for tests — anything satisfying the slice of the SDK we use. */
  clientImpl?: GenAiLike;
}

/** The exact slice of the SDK this module depends on. Keeps tests honest. */
export interface GenAiLike {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: Record<string, unknown>;
    }): Promise<GenerateContentResponse>;
  };
}

/** HTTP status carried on SDK errors, when it can be recovered. */
function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const rec = err as Record<string, unknown>;
  if (typeof rec.status === 'number') return rec.status;
  if (typeof rec.code === 'number') return rec.code;
  // The SDK stringifies some transport failures as `[429 ...] message`.
  const msg = typeof rec.message === 'string' ? rec.message : '';
  const m = /^\[?(\d{3})\b/.exec(msg);
  return m?.[1] ? Number(m[1]) : undefined;
}

function citationsOf(res: GenerateContentResponse): Citation[] {
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const out: Citation[] = [];
  for (const c of chunks) {
    const uri = c.web?.uri;
    if (uri) out.push({ title: c.web?.title ?? uri, url: uri });
  }
  return out;
}

export function createGenAiClient(config: GenAiClientConfig): LlmClient {
  const groundedModel = config.model ?? DEFAULT_GROUNDED_MODEL;
  const structureModel = config.structureModel ?? DEFAULT_STRUCTURE_MODEL;

  if (!config.clientImpl && !config.apiKey && !config.vertex) {
    throw new Error(
      'createGenAiClient needs either an apiKey or vertex credentials — refusing to start unauthenticated.',
    );
  }

  const ai: GenAiLike =
    config.clientImpl ??
    (new GoogleGenAI(
      config.vertex
        ? { vertexai: true, project: config.vertex.project, location: config.vertex.location }
        : // Same defence as gemini.ts: pasted keys carry invisible characters.
          { apiKey: (config.apiKey ?? '').replace(/[^\x20-\x7E]/g, '').trim() },
    ) as unknown as GenAiLike);

  const groundedRpm = config.groundedRpm ?? DEFAULT_GROUNDED_RPM;
  const structureRpm = config.structureRpm ?? DEFAULT_STRUCTURE_RPM;
  const groundLimiter = groundedRpm > 0 ? createRateLimiter(groundedRpm) : null;
  const structureLimiter = structureRpm > 0 ? createRateLimiter(structureRpm) : null;

  async function call(
    model: string,
    contents: string,
    cfg: Record<string, unknown>,
    signal: AbortSignal | undefined,
    kind: 'ground' | 'structure',
  ): Promise<GenerateContentResponse> {
    await (kind === 'ground' ? groundLimiter : structureLimiter)?.acquire(signal);
    const res = await withRetry(
      async () => {
        try {
          return await ai.models.generateContent({
            model,
            contents,
            config: signal ? { ...cfg, abortSignal: signal } : cfg,
          });
        } catch (err) {
          // Re-shape into the retry contract shared with the fetch client, so
          // 429/5xx back off identically no matter which client is in play.
          const status = statusOf(err);
          const wrapped = new Error(
            `Gemini ${status ?? 'error'}: ${err instanceof Error ? err.message : String(err)}`,
          ) as RetryableError;
          if (status !== undefined) wrapped.status = status;
          throw wrapped;
        }
      },
      { signal },
    );

    const usageMeta = res.usageMetadata;
    const usage: GenAiUsage | undefined = usageMeta
      ? {
          ...(typeof usageMeta.promptTokenCount === 'number' ? { promptTokens: usageMeta.promptTokenCount } : {}),
          ...(typeof usageMeta.candidatesTokenCount === 'number'
            ? { candidatesTokens: usageMeta.candidatesTokenCount }
            : {}),
          ...(typeof usageMeta.totalTokenCount === 'number' ? { totalTokens: usageMeta.totalTokenCount } : {}),
        }
      : undefined;

    config.onCall?.({
      model,
      kind,
      ...(usage && Object.keys(usage).length > 0 ? { usage } : {}),
    });

    return res;
  }

  return {
    async ground(prompt, opts) {
      const cfg: Record<string, unknown> = {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      };
      if (opts?.system) cfg.systemInstruction = opts.system;
      const res = await call(groundedModel, prompt, cfg, opts?.signal, 'ground');
      if (res.promptFeedback?.blockReason) {
        throw new Error(`Gemini blocked the request: ${res.promptFeedback.blockReason}`);
      }
      return {
        text: (res.text ?? '').trim(),
        citations: citationsOf(res),
        queries: res.candidates?.[0]?.groundingMetadata?.webSearchQueries ?? [],
      };
    },

    async structure<T>(
      prompt: string,
      schema: ZodType<T, ZodTypeDef, unknown>,
      opts?: { system?: string; signal?: AbortSignal },
    ): Promise<T> {
      const cfg: Record<string, unknown> = {
        responseMimeType: 'application/json',
        temperature: 0,
      };
      if (opts?.system) cfg.systemInstruction = opts.system;
      let lastError: unknown;
      // One reparse retry, matching gemini.ts: JSON mode is reliable, not infallible.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const res = await call(structureModel, prompt, cfg, opts?.signal, 'structure');
        try {
          return schema.parse(extractJson((res.text ?? '').trim()));
        } catch (err) {
          lastError = err;
        }
      }
      throw new Error(
        `Failed to structure Gemini output: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      );
    },
  };
}
