/**
 * Nano-banana article covers — REAL generated imagery, prompted from the
 * research itself (founder-approved spend: "use nano banana and showcase it").
 *
 * Each cover is generated once per story via Gemini's image model with the
 * user's own key, prompted from the headline + reported detail so the image
 * genuinely fits the article. Results cache in-memory for the session;
 * generation is concurrency-limited so a 15-story news tab trickles in
 * instead of firing 15 simultaneous calls at the rate limiter.
 *
 * Honesty note: generated covers are ILLUSTRATIONS of the story's subject —
 * never presented as photos of real people or real events. The prompt forbids
 * text, logos, and real-person likenesses.
 */
import { useEffect, useState } from 'react';
import { useApiKey } from '@/lib/settings/apiKey';

const IMAGE_MODEL = 'gemini-2.5-flash-image';
const MAX_CONCURRENT = 2;

const cache = new Map<string, string>(); // cacheKey → data URL
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

function coverPrompt(subject: string, context: string | null): string {
  return [
    `Editorial cover illustration for a news story.`,
    `Story: ${subject}`,
    context ? `Reported detail: ${context}` : '',
    `Style: premium modern editorial illustration — clean composition, strong single concept, sophisticated muted palette with one accent color, subtle grain. Conceptual, magazine-quality.`,
    `Hard rules: NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks, NO real people's faces or likenesses.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function generate(apiKey: string, subject: string, context: string | null): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: coverPrompt(subject, context) }] }],
      }),
    },
  );
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

/**
 * Resolve (or start generating) the AI cover for a story.
 * Returns the cached data URL immediately when available; otherwise kicks off
 * generation and resolves when done. Null = no key / generation failed
 * (callers fall back to the designed editorial cover).
 */
export function getAiCover(
  cacheKey: string,
  subject: string,
  context: string | null,
): Promise<string | null> {
  if (cache.has(cacheKey)) return Promise.resolve(cache.get(cacheKey)!);
  if (failed.has(cacheKey)) return Promise.resolve(null);
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const apiKey = useApiKey.getState().apiKey;
  if (!apiKey) return Promise.resolve(null);

  const p = slot(() => generate(apiKey, subject, context))
    .then((url) => {
      if (url) cache.set(cacheKey, url);
      else failed.add(cacheKey);
      return url;
    })
    .catch(() => {
      failed.add(cacheKey);
      return null;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });
  inFlight.set(cacheKey, p);
  return p;
}

/** Hook: the AI cover for a story — null while generating/unavailable. */
export function useAiCover(
  cacheKey: string,
  subject: string,
  context: string | null,
  enabled = true,
): string | null {
  const hasKey = useApiKey((s) => s.hasKey);
  const [url, setUrl] = useState<string | null>(cache.get(cacheKey) ?? null);
  useEffect(() => {
    if (!enabled || !hasKey) return;
    let live = true;
    void getAiCover(cacheKey, subject, context).then((u) => {
      if (live && u) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [cacheKey, subject, context, enabled, hasKey]);
  return url;
}
