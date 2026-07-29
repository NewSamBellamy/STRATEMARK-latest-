import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

/** Extract a clean root domain from a URL/host. */
function domainOf(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const host = website.includes('://') ? new URL(website).hostname : website.trim();
    const domain = host.replace(/^www\./, '').toLowerCase();
    // RFC 2606 reserved domains are placeholders (used by the demo dataset) —
    // icon services serve generic globes for them, so treat as "no site".
    if (/(^|\.)example\.(com|org|net)$/.test(domain) || domain.endsWith('.test') || domain.endsWith('.invalid')) {
      return null;
    }
    return domain || null;
  } catch {
    return null;
  }
}

/** A hero window wants ≥48px source art; below that we keep it as a small chip. */
const HERO_MIN_PX = 48;

/**
 * Real company logo, resolved for free with a fallback chain and no API key:
 *   unavatar.io (aggregates favicon/logo sources) → icon.horse →
 *   Google faviconV2 @256 → DuckDuckGo icons.
 *
 * Quality assurance for hero (`bare`) usage:
 *  - a source that loads but is tiny (<48px) is remembered, not blown up —
 *    if nothing better exists it renders as a small crisp chip above the
 *    company name (never blurry mush);
 *  - if nothing loads at all, a designed brand-colored lettermark plate;
 *  - `retryNonce` re-walks the whole chain with cache-busting (user-directed
 *    rerun via right-click).
 */
export function Logo({
  name,
  website,
  className,
  onColor,
  bare = false,
  retryNonce = 0,
}: {
  name: string;
  website: string | null | undefined;
  className?: string;
  /** Fires with the logo's dominant color when extraction succeeds (CORS-permitting). */
  onColor?: (hex: string) => void;
  /** Render without the chip chrome (used inside the card's hero window). */
  bare?: boolean;
  /** Bump to re-walk the source chain with fresh (cache-busted) requests. */
  retryNonce?: number;
}) {
  const sources = useMemo(() => {
    const domain = domainOf(website);
    if (!domain) return [];
    const bust = retryNonce > 0 ? `r=${retryNonce}` : '';
    const q = (sep: string) => (bust ? `${sep}${bust}` : '');
    // NOTE: icon.horse is deliberately absent (returns its own grey
    // placeholder with HTTP 200) and gstatic runs WITHOUT fallback_opts (so it
    // 404s instead of serving a default globe). Sources must fail honestly —
    // a generic placeholder poisons both the hero and color extraction.
    return [
      `https://unavatar.io/${domain}?fallback=false${q('&')}`,
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=https://${domain}&size=256${q('&')}`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico${q('?')}`,
    ];
  }, [website, retryNonce]);

  const [idx, setIdx] = useState(0);
  const [smallSrc, setSmallSrc] = useState<string | null>(null);
  useEffect(() => {
    // New retry pass: start the chain over.
    setIdx(0);
    setSmallSrc(null);
  }, [retryNonce, website]);

  const src = sources[idx];
  const exhausted = !src;

  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden font-display font-bold text-content',
        bare ? 'text-2xl' : 'game-card__logo rounded-xl text-sm',
        className,
      )}
    >
      {!exhausted ? (
        <img
          key={src}
          src={src}
          alt={`${name} logo`}
          className={cn('h-full w-full object-contain', bare ? 'p-1' : 'p-1.5')}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
          onLoad={(e) => {
            const w = e.currentTarget.naturalWidth;
            // Hero windows render the logo LARGE — don't blow up tiny favicons.
            // Keep the best small candidate and keep hunting for real art.
            // The last-resort source (DDG) serves a default globe for unknown
            // domains, so a tiny icon from it isn't trusted as brand art —
            // those cases fall through to the lettermark plate instead.
            if (bare && w > 0 && w < HERO_MIN_PX) {
              if (idx < sources.length - 1) setSmallSrc((prev) => prev ?? src);
              setIdx((i) => i + 1);
              return;
            }
            if (!onColor) return;
            void import('@/lib/extractColor').then(({ extractDominantColor }) =>
              extractDominantColor(src).then((hex) => hex && onColor(hex)),
            );
          }}
        />
      ) : bare && smallSrc ? (
        // Hybrid plate: the real (small) mark, crisp at its honest size + name.
        <span className="flex max-w-full flex-col items-center justify-center gap-2 px-2 text-center">
          <img
            src={smallSrc}
            alt={`${name} logo`}
            className="h-9 w-9 rounded-md object-contain"
            referrerPolicy="no-referrer"
          />
          <span className="max-w-full truncate text-[8.5px] font-semibold uppercase tracking-[0.2em] text-faint">
            {name}
          </span>
        </span>
      ) : bare ? (
        // Designed lettermark plate — brand-colored initials + the full name.
        <span
          aria-label={`${name} monogram`}
          className="flex max-w-full flex-col items-center justify-center gap-1.5 px-2 text-center"
        >
          <span
            className="font-display text-[42px] font-bold leading-none tracking-tight"
            style={{ color: 'var(--tcg-primary, #3F3F46)', opacity: 0.88 }}
          >
            {initials(name)}
          </span>
          <span className="max-w-full truncate text-[8.5px] font-semibold uppercase tracking-[0.2em] text-faint">
            {name}
          </span>
        </span>
      ) : (
        <span aria-label={`${name} monogram`}>{initials(name)}</span>
      )}
    </div>
  );
}
