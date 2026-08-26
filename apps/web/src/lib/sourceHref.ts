/**
 * Every citation must CLICK THROUGH somewhere useful — a tribute to the
 * reporters (founder's framing). Gemini's grounding metadata often carries
 * opaque redirect URLs that expire; when a link isn't a real, durable
 * publisher URL, we send the reader to a precise search for the exact story
 * instead of a dead tab.
 */
export function isGroundingRedirect(url: string): boolean {
  return /vertexaisearch|grounding-api-redirect/i.test(url);
}

export function sourceHref(url: string, title?: string | null): string {
  if (/^https?:\/\//i.test(url) && !isGroundingRedirect(url)) return url;
  const q = (title ?? '').trim().slice(0, 120) || url;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** Label hint: true when the link opens the source directly. */
export function isDirectSource(url: string): boolean {
  return /^https?:\/\//i.test(url) && !isGroundingRedirect(url);
}
