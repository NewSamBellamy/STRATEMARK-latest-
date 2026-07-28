/** Small dependency-free orchestration helpers for the pipeline. */

export class AbortError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AbortError();
}

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError());
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new AbortError());
    });
  });

export interface RetryableError extends Error {
  status?: number;
}

/**
 * Retry with exponential backoff + jitter. Retries on 429 (rate limit) and 5xx,
 * respecting an optional Retry-After (ms) carried on the error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const retries = opts.retries ?? 4;
  const base = opts.baseDelayMs ?? 1200;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as RetryableError).status;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt >= retries) throw err;
      const retryAfter = (err as RetryableError & { retryAfterMs?: number }).retryAfterMs;
      const delay = retryAfter ?? base * 2 ** attempt + Math.random() * 400;
      attempt += 1;
      await sleep(delay, opts.signal);
    }
  }
}

/** Run `fn` over `items` with bounded concurrency, preserving input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      throwIfAborted(signal);
      const index = cursor++;
      results[index] = await fn(items[index] as T, index);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

/** Extract a clean root domain from a URL or bare host. */
export function rootDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const host = input.includes('://') ? new URL(input).hostname : input.trim();
    return host.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Best-effort JSON extraction from a model response that may wrap JSON in prose/fences. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  // Try direct parse, then the first {...} / [...] block.
  try {
    return JSON.parse(candidate);
  } catch {
    const match = candidate.match(/[{[][\s\S]*[}\]]/);
    if (match) return JSON.parse(match[0]);
    throw new Error('No JSON found in model response');
  }
}
