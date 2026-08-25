/**
 * Keyless live page captures (WordPress mShots).
 *
 * Any URL → a real screenshot of that page: article hero images, headlines,
 * product pages — genuine imagery with zero API keys and zero research spend.
 * While the capture renders server-side the service returns a small
 * placeholder; callers detect it by natural width and re-request with a
 * cache-buster until the real capture arrives ("keeps trying until it's right").
 *
 * Captures are always requested at 1280px (CSS downscales thumbnails) so the
 * placeholder-vs-real width heuristic stays valid at every display size.
 */
export function pageShotUrl(url: string, attempt = 0): string {
  const base = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1280&h=800`;
  return attempt === 0 ? base : `${base}&r=${attempt}`;
}

/** mShots' "generating…" placeholder is far narrower than a real 1280px capture. */
export const SHOT_PLACEHOLDER_MAX_WIDTH = 700;
export const SHOT_MAX_ATTEMPTS = 8;
export const SHOT_RETRY_MS = 3500;

/** Publisher favicon — a dependable small real image for source chips. */
export function faviconUrl(pageUrl: string, size = 64): string {
  try {
    const domain = new URL(pageUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
  } catch {
    return `https://www.google.com/s2/favicons?domain=example.com&sz=${size}`;
  }
}
