/**
 * Free-tier usage meter.
 *
 * Measured limits (2026-07) on a Google AI Studio free key: ~15 requests/minute
 * on the flash line, ~30 on flash-lite, 1,500 requests/day. A 10-company deck
 * costs ~27 requests, so a day comfortably fits well over the 3–5 decks we
 * promise — but users can't see that, and invisible quota feels like risk.
 *
 * So we count locally (nothing leaves the browser) and show honest headroom:
 * requests today, and roughly how many more decks that buys.
 */
const KEY = 'mi.usage.v1';
/** Documented free-tier daily request cap. */
export const DAILY_REQUEST_CAP = 1500;
/** Measured cost of one ~10-company deck, after batching the tier review. */
export const REQUESTS_PER_DECK = 27;

export interface UsageDay {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  grounded: number;
  structure: number;
  decks: number;
}

const today = (): string => new Date().toISOString().slice(0, 10);

function read(): UsageDay {
  const fresh: UsageDay = { day: today(), grounded: 0, structure: 0, decks: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as UsageDay;
    // A new day resets the window, matching how the quota actually behaves.
    return parsed.day === fresh.day ? { ...fresh, ...parsed } : fresh;
  } catch {
    return fresh;
  }
}

function write(u: UsageDay): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    /* private mode — meter is session-only, never a hard failure */
  }
}

/** Record one outbound model request. */
export function recordCall(kind: 'ground' | 'structure'): void {
  const u = read();
  if (kind === 'ground') u.grounded += 1;
  else u.structure += 1;
  write(u);
  notify();
}

/** Record a completed deck build (for a human-scale "decks today" number). */
export function recordDeck(): void {
  const u = read();
  u.decks += 1;
  write(u);
  notify();
}

export interface UsageSummary extends UsageDay {
  total: number;
  remaining: number;
  /** Whole decks the remaining budget can still cover. */
  decksLeft: number;
  percentUsed: number;
}

export function getUsage(): UsageSummary {
  const u = read();
  const total = u.grounded + u.structure;
  const remaining = Math.max(0, DAILY_REQUEST_CAP - total);
  return {
    ...u,
    total,
    remaining,
    decksLeft: Math.floor(remaining / REQUESTS_PER_DECK),
    percentUsed: Math.min(100, Math.round((total / DAILY_REQUEST_CAP) * 100)),
  };
}

// --- tiny subscription so the UI can live-update without a store dependency ---
const listeners = new Set<() => void>();
function notify(): void {
  for (const l of listeners) l();
}
export function subscribeUsage(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
