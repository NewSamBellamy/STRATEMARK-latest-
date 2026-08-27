/**
 * Nano-banana article covers — REAL generated imagery, prompted from the
 * research itself (founder-approved spend: "use nano banana and showcase it").
 *
 * Three founder-driven rules shape this module:
 *   1. ASPECT IS EXPLICIT — every surface asks for the shape it renders
 *      (16:9 panels, 4:3 thumbs), so images stop arriving cropped.
 *   2. CONCRETE OVER ABSTRACT — prompts depict the actual subject of the
 *      story (the product, the place, the scene) in one of several editorial
 *      registers picked deterministically per item, so a page of covers has
 *      variety instead of a wall of same-y abstractions.
 *   3. PAID ONCE, KEPT FOREVER — every generated image persists in the
 *      IndexedDB vault. A refresh must never re-bill the user's key for an
 *      image that already exists; regeneration only happens via the explicit
 *      re-spin control.
 *
 * Honesty note: generated covers are ILLUSTRATIONS of the story's subject —
 * never presented as photos of real people or real events. The prompt forbids
 * text, logos, and real-person likenesses.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApiKey } from '@/lib/settings/apiKey';
import { imageDelete, imageGet, imagePut } from '@/lib/repository/vault';
import { imagesAllowed, recordCall } from '@/lib/usage';

/**
 * Nano Banana 2 Lite — the current cheapest/fastest image model. The previous
 * generation stays as a fallback: if an account can't reach the newest model
 * (404/403), art still generates instead of the surface silently going bare.
 */
const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
const IMAGE_MODEL_FALLBACK = 'gemini-2.5-flash-image';
const MAX_CONCURRENT = 2;

export type CoverAspect = '16:9' | '4:3' | '1:1' | '3:4';

const cache = new Map<string, string>(); // storageKey → data URL
const failed = new Set<string>();
const inFlight = new Map<string, Promise<string | null>>();
let active = 0;
const waiters: Array<() => void> = [];

async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  active += 1;
  try {
    return await work();
  } finally {
    active -= 1;
    waiters.shift()?.();
  }
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Editorial registers, rotated deterministically per item. Variety is the
 * anti-"it all looks AI-generated" move; every register still demands a
 * CONCRETE depiction of the subject.
 */
const REGISTERS = [
  'clean documentary editorial photography — a realistic, concrete scene with natural light',
  'modern flat editorial illustration — bold shapes, confident colors, clear subject',
  'detailed isometric illustration of the concrete setting and objects involved',
  'painterly editorial illustration — realistic subject, warm believable light, magazine quality',
] as const;

function coverPrompt(cacheKey: string, subject: string, context: string | null): string {
  const register = REGISTERS[hashCode(cacheKey) % REGISTERS.length]!;
  return [
    `Editorial cover image for a market-intelligence story.`,
    `Story: ${subject}`,
    context ? `Reported detail: ${context}` : '',
    `DEPICT THE CONCRETE SUBJECT of the story — the actual product category, the place, the industry scene, the objects involved — composed like a magazine feature image. Not an abstract metaphor, not floating geometric shapes.`,
    `Style: ${register}. Fill the full frame edge-to-edge with the scene (no borders, no letterboxing).`,
    `Hard rules: NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks, NO real people's faces or likenesses, NO user-interface screenshots.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function generate(
  apiKey: string,
  cacheKey: string,
  subject: string,
  context: string | null,
  aspect: CoverAspect,
): Promise<string | null> {
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: coverPrompt(cacheKey, subject, context) }] }],
    generationConfig: { imageConfig: { aspectRatio: aspect } },
  };
  const post = (model: string): Promise<Response> =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });

  let model = IMAGE_MODEL;
  let res = await post(model);
  if (res.status === 404 || res.status === 403) {
    // Newest image model not available to this key — fall back a generation.
    model = IMAGE_MODEL_FALLBACK;
    res = await post(model);
  }
  if (res.status === 400) {
    // Older API surface without imageConfig — retry without it rather than fail.
    delete body.generationConfig;
    res = await post(model);
  }
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
  };
  for (const part of data.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType ?? 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

const storageKey = (cacheKey: string, aspect: CoverAspect): string => `${cacheKey}@${aspect}`;

const ALL_ASPECTS: CoverAspect[] = ['16:9', '4:3', '1:1', '3:4'];

/**
 * One generation per STORY, not per surface. When the thumb (4:3) and the
 * reader (16:9) both want art for the same item, the first paid image serves
 * both (object-cover crops gracefully) — the filmed "image shows here but not
 * there" inconsistency was two aspect variants generating independently and
 * landing at different times, doubling the bill along the way.
 */
const generatingByStory = new Map<string, Promise<string | null>>();

/** Any already-available variant of this story, memory first, then vault. */
async function anyVariant(cacheKey: string, except: CoverAspect): Promise<string | null> {
  for (const a of ALL_ASPECTS) {
    if (a === except) continue;
    const hit = cache.get(storageKey(cacheKey, a));
    if (hit) return hit;
  }
  for (const a of ALL_ASPECTS) {
    if (a === except) continue;
    const stored = await imageGet(storageKey(cacheKey, a));
    if (stored) return stored;
  }
  return null;
}

/**
 * Resolve (or start generating) the AI cover for a story.
 * Order: memory → IndexedDB vault (paid-for images survive refreshes) →
 * generation. Null = no key / generation failed (callers fall back to the
 * designed editorial cover).
 */
export function getAiCover(
  cacheKey: string,
  subject: string,
  context: string | null,
  aspect: CoverAspect = '16:9',
): Promise<string | null> {
  const key = storageKey(cacheKey, aspect);
  if (cache.has(key)) return Promise.resolve(cache.get(key)!);
  if (failed.has(key)) return Promise.resolve(null);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const p = (async (): Promise<string | null> => {
    // The vault first: an image the key already paid for is never re-billed.
    const stored = await imageGet(key);
    if (stored) {
      cache.set(key, stored);
      return stored;
    }
    // A sibling aspect that's already paid for serves this surface too —
    // every surface of a story shows the SAME art, and the story only ever
    // bills one generation.
    const sibling = await anyVariant(cacheKey, aspect);
    if (sibling) {
      cache.set(key, sibling);
      return sibling;
    }
    // A sibling aspect mid-generation? Wait for it instead of double-billing.
    const inflightStory = generatingByStory.get(cacheKey);
    if (inflightStory) {
      const shared = await inflightStory;
      if (shared) {
        cache.set(key, shared);
        return shared;
      }
    }
    const apiKey = useApiKey.getState().apiKey;
    if (!apiKey) return null;
    // Opt-out + spending cap: generation is autonomous spend — it asks first.
    // (Vault reads above still serve already-paid-for images either way.)
    if (!imagesAllowed()) return null;
    recordCall('image');
    const gen = slot(() => generate(apiKey, cacheKey, subject, context, aspect));
    generatingByStory.set(cacheKey, gen);
    const url = await gen.finally(() => generatingByStory.delete(cacheKey));
    if (url) {
      cache.set(key, url);
      void imagePut(key, url);
    } else {
      failed.add(key);
    }
    return url;
  })()
    .catch(() => {
      failed.add(key);
      return null;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, p);
  return p;
}

/** The re-spin: discard the stored image and generate a fresh take. */
export async function respinAiCover(
  cacheKey: string,
  subject: string,
  context: string | null,
  aspect: CoverAspect = '16:9',
): Promise<string | null> {
  // Variants share one image now — a respin that left a sibling behind would
  // just resurrect the old art, so every variant goes.
  for (const a of ALL_ASPECTS) {
    const key = storageKey(cacheKey, a);
    cache.delete(key);
    failed.delete(key);
    await imageDelete(key);
  }
  return getAiCover(cacheKey, subject, context, aspect);
}

/** Hook: the AI cover for a story — null while generating/unavailable. */
export function useAiCover(
  cacheKey: string,
  subject: string,
  context: string | null,
  aspect: CoverAspect = '16:9',
  enabled = true,
): { url: string | null; respinning: boolean; respin: () => void } {
  const hasKey = useApiKey((s) => s.hasKey);
  const [url, setUrl] = useState<string | null>(cache.get(storageKey(cacheKey, aspect)) ?? null);
  const [respinning, setRespinning] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    // Vault reads work keyless too — an already-paid-for image still shows.
    void getAiCover(cacheKey, subject, context, aspect).then((u) => {
      if (live && u) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [cacheKey, subject, context, aspect, enabled, hasKey]);

  const respin = useCallback(() => {
    if (!useApiKey.getState().apiKey || respinning || !imagesAllowed()) return;
    setRespinning(true);
    void respinAiCover(cacheKey, subject, context, aspect)
      .then((u) => {
        if (u) setUrl(u);
      })
      .finally(() => setRespinning(false));
  }, [cacheKey, subject, context, aspect, respinning]);

  return { url, respinning, respin };
}
