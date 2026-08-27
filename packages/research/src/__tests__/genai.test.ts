import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { GenerateContentResponse } from '@google/genai';
import { createGenAiClient, type GenAiLike } from '../genai';
import type { LlmClient } from '../types';

/**
 * Minimal SDK response shaped like the real one.
 *
 * Loosely typed on purpose: the SDK's response is a class with getters and
 * branded enums, and reconstructing that faithfully in a test would assert
 * things about the SDK rather than about our adapter.
 */
function res(partial: Record<string, unknown>): GenerateContentResponse {
  return partial as unknown as GenerateContentResponse;
}

/** The call signature the adapter uses — annotated so spies infer their args. */
type GenerateContent = GenAiLike['models']['generateContent'];
type GenerateArgs = Parameters<GenerateContent>[0];

function stub(impl: GenerateContent): GenAiLike {
  return { models: { generateContent: impl } };
}

describe('createGenAiClient', () => {
  it('refuses to construct without credentials — never runs unauthenticated', () => {
    expect(() => createGenAiClient({})).toThrow(/apiKey or vertex/);
  });

  it('satisfies the LlmClient contract the ADK task graph depends on', () => {
    // Compile-time proof: if the shape drifts, typecheck fails before tests do.
    const client: LlmClient = createGenAiClient({
      apiKey: 'k',
      groundedRpm: 0,
      structureRpm: 0,
      clientImpl: stub(async () => res({ text: '' })),
    });
    expect(typeof client.ground).toBe('function');
    expect(typeof client.structure).toBe('function');
  });

  it('sends the Google Search tool on every grounded call', async () => {
    const spy = vi.fn(async (_p: GenerateArgs) => res({ text: 'grounded answer' }));
    const client = createGenAiClient({
      apiKey: 'k',
      groundedRpm: 0,
      structureRpm: 0,
      clientImpl: stub(spy),
    });
    await client.ground('who leads the market?', { system: 'be terse' });

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0]?.[0];
    expect(arg?.config?.tools).toEqual([{ googleSearch: {} }]);
    expect(arg?.config?.systemInstruction).toBe('be terse');
  });

  it('extracts citations and search queries from grounding metadata', async () => {
    const client = createGenAiClient({
      apiKey: 'k',
      groundedRpm: 0,
      structureRpm: 0,
      clientImpl: stub(async () =>
        res({
          text: '  spaced  ',
          candidates: [
            {
              groundingMetadata: {
                groundingChunks: [
                  { web: { uri: 'https://a.com', title: 'A' } },
                  { web: { title: 'no uri — dropped' } },
                  { web: { uri: 'https://b.com' } },
                ],
                webSearchQueries: ['market leaders 2026'],
              },
            },
          ],
        }),
      ),
    });

    const out = await client.ground('q');
    expect(out.text).toBe('spaced');
    // A chunk with no URI is not a citation — it cannot be verified.
    expect(out.citations).toEqual([
      { title: 'A', url: 'https://a.com' },
      { title: 'https://b.com', url: 'https://b.com' },
    ]);
    expect(out.queries).toEqual(['market leaders 2026']);
  });

  it('throws when the prompt is blocked rather than returning empty research', async () => {
    const client = createGenAiClient({
      apiKey: 'k',
      groundedRpm: 0,
      structureRpm: 0,
      clientImpl: stub(async () => res({ text: '', promptFeedback: { blockReason: 'SAFETY' } })),
    });
    await expect(client.ground('q')).rejects.toThrow(/blocked.*SAFETY/);
  });

  it('structures JSON against a Zod schema', async () => {
    const client = createGenAiClient({
      apiKey: 'k',
      groundedRpm: 0,
      structureRpm: 0,
      clientImpl: stub(async () => res({ text: '{"name":"OpenAI","tier":8}' })),
    });
    const out = await client.structure('extract', z.object({ name: z.string(), tier: z.number() }));
    expect(out).toEqual({ name: 'OpenAI', tier: 8 });
  });

  it('requests JSON mode when structuring', async () => {
    const spy = vi.fn(async (_p: GenerateArgs) => res({ text: '{"ok":true}' }));
    const client = createGenAiClient({
      apiKey: 'k',
      groundedRpm: 0,
      structureRpm: 0,
      clientImpl: stub(spy),
    });
    await client.structure('x', z.object({ ok: z.boolean() }));
    expect(spy.mock.calls[0]?.[0]?.config?.responseMimeType).toBe('application/json');
  });

  it('retries a malformed structuring response exactly once, then fails loudly', async () => {
    const spy = vi.fn(async (_p: GenerateArgs) => res({ text: 'not json at all' }));
    const client = createGenAiClient({
      apiKey: 'k',
      groundedRpm: 0,
      structureRpm: 0,
      clientImpl: stub(spy),
    });
    await expect(client.structure('x', z.object({ ok: z.boolean() }))).rejects.toThrow(
      /Failed to structure/,
    );
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('reports the model and kind of every call so spend can be metered', async () => {
    const onCall = vi.fn();
    const client = createGenAiClient({
      apiKey: 'k',
      groundedRpm: 0,
      structureRpm: 0,
      model: 'gemini-3.7-flash',
      structureModel: 'gemini-3.5-flash-lite',
      onCall,
      clientImpl: stub(async () => res({ text: '{"ok":true}' })),
    });

    await client.ground('q');
    await client.structure('x', z.object({ ok: z.boolean() }));

    expect(onCall).toHaveBeenNthCalledWith(1, { model: 'gemini-3.7-flash', kind: 'ground' });
    expect(onCall).toHaveBeenNthCalledWith(2, { model: 'gemini-3.5-flash-lite', kind: 'structure' });
  });

  it('preserves the HTTP status from SDK errors so backoff behaves', async () => {
    const err = Object.assign(new Error('rate limited'), { status: 429 });
    let calls = 0;
    const client = createGenAiClient({
      apiKey: 'k',
      groundedRpm: 0,
      structureRpm: 0,
      clientImpl: stub(async () => {
        calls += 1;
        if (calls === 1) throw err;
        return res({ text: 'recovered' });
      }),
    });
    const out = await client.ground('q');
    expect(out.text).toBe('recovered');
    expect(calls).toBe(2);
  });
});
