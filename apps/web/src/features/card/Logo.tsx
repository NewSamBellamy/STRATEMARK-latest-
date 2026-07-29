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

/**
 * Hero-logo quality thresholds.
 *
 * Logo services return wildly different resolutions for the same mark — 256px
 * for one company, a 32px browser favicon for another. Two consequences we have
 * to engineer around:
 *
 *  1. Taking the FIRST source that loads means a 32px favicon can beat a 400px
 *     logo that was one position further down the chain → blurry hero art. So we
 *     probe for the BEST available resolution instead, stopping early once a
 *     source is clearly good enough.
 *  2. Rendering every winner at the same box size makes the deck look broken
 *     (crisp 256px marks filling the window next to postage stamps). So the
 *     footprint scales with the resolution we actually got, kept inside a narrow
 *     band so the grid still reads as one set.
 *
 * Below MIN_USABLE_PX it isn't brand art at all — it's a tab icon — and the
 * designed lettermark plate beats an upscaled smear.
 */
const GOOD_ENOUGH_PX = 96;
const MIN_USABLE_PX = 24;
/** Below this the mark can't fill the window without visible blur. */
const CRISP_PX = 64;
/** Hard ceiling on upscaling — past ~2x, raster marks turn to mush. */
const MAX_UPSCALE = 2;

function heroScale(naturalWidth: number): string {
  if (naturalWidth >= 128) return '100%';
  return '92%';
}

interface Candidate {
  src: string;
  width: number;
}

/** Load an image off-screen just to learn whether it exists and how big it is. */
function probe(src: string): Promise<Candidate | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img.naturalWidth > 0 ? { src, width: img.naturalWidth } : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Real company logo, resolved for free with no API key. Walks the source chain
 * and keeps the highest-resolution hit (short-circuiting once one is clearly
 * sharp enough), so hero art is as crisp as the open web allows.
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
    // NOTE: icon.horse is deliberately absent (returns its own grey placeholder
    // with HTTP 200) and gstatic runs WITHOUT fallback_opts (so it 404s instead
    // of serving a default globe). Sources must fail honestly — a generic
    // placeholder poisons both the hero and the brand-color extraction.
    return [
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=https://${domain}&size=256${q('&')}`,
      `https://unavatar.io/${domain}?fallback=false${q('&')}`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico${q('?')}`,
    ];
  }, [website, retryNonce]);

  const [best, setBest] = useState<Candidate | null>(null);
  const [settled, setSettled] = useState(false);
  const key = sources.join('|');

  useEffect(() => {
    setBest(null);
    setSettled(false);
    if (sources.length === 0) {
      setSettled(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      let winner: Candidate | null = null;
      for (const src of sources) {
        const hit = await probe(src);
        if (cancelled) return;
        if (hit && (!winner || hit.width > winner.width)) {
          winner = hit;
          setBest(winner);
          if (hit.width >= GOOD_ENOUGH_PX) break; // sharp enough; stop paying for probes
        }
      }
      if (!cancelled) setSettled(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Brand-color extraction runs on the winning source only.
  useEffect(() => {
    if (!onColor || !best || best.width < MIN_USABLE_PX) return;
    let cancelled = false;
    void import('@/lib/extractColor').then(({ extractDominantColor }) =>
      extractDominantColor(best.src).then((hex) => {
        if (!cancelled && hex) onColor(hex);
      }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [best?.src]);

  const usable = best && best.width >= MIN_USABLE_PX ? best : null;

  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden font-display font-bold text-content',
        bare ? 'text-2xl' : 'game-card__logo rounded-xl text-sm',
        className,
      )}
    >
      {usable && bare && usable.width < CRISP_PX ? (
        // Low-res mark: show it at its honest size (capped upscale) inside a
        // composed plate with the name beneath — same composition family as the
        // lettermark below, so the grid still reads as one set instead of one
        // card having a blurry balloon.
        <span className="flex max-w-full flex-col items-center justify-center gap-2.5 px-2 text-center">
          <img
            src={usable.src}
            alt={`${name} logo`}
            className="object-contain"
            style={{ width: usable.width * MAX_UPSCALE, height: usable.width * MAX_UPSCALE }}
            referrerPolicy="no-referrer"
          />
          <span className="max-w-full truncate text-[8.5px] font-semibold uppercase tracking-[0.2em] text-faint">
            {name}
          </span>
        </span>
      ) : usable ? (
        <img
          src={usable.src}
          alt={`${name} logo`}
          className={cn('object-contain', bare ? 'p-1' : 'h-full w-full p-1.5')}
          style={bare ? { width: heroScale(usable.width), height: heroScale(usable.width) } : undefined}
          referrerPolicy="no-referrer"
        />
      ) : !settled ? (
        // Probing — hold the space so cards don't jump as art resolves.
        <span aria-hidden className="block h-full w-full" />
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
