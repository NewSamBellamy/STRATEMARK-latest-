import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

/** Extract a clean root domain from a URL/host. */
function domainOf(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const host = website.includes('://') ? new URL(website).hostname : website.trim();
    return host.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Real company logo, resolved for free with a fallback chain and no API key:
 *   unavatar.io (aggregates favicon/logo sources) → Google faviconV2 →
 *   DuckDuckGo icons → monogram.
 * Each source loads as a plain cross-origin <img>; on error we advance to the
 * next, and finally render initials — so it NEVER shows a broken image.
 */
export function Logo({
  name,
  website,
  className,
  onColor,
  bare = false,
}: {
  name: string;
  website: string | null | undefined;
  className?: string;
  /** Fires with the logo's dominant color when extraction succeeds (CORS-permitting). */
  onColor?: (hex: string) => void;
  /** Render without the chip chrome (used inside the card's hero window). */
  bare?: boolean;
}) {
  const sources = useMemo(() => {
    const domain = domainOf(website);
    if (!domain) return [];
    return [
      `https://unavatar.io/${domain}?fallback=false`,
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    ];
  }, [website]);

  const [idx, setIdx] = useState(0);
  const src = sources[idx];

  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden font-display font-bold text-content',
        bare ? 'text-2xl' : 'game-card__logo rounded-xl text-sm',
        className,
      )}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={`${name} logo`}
          className={cn('h-full w-full object-contain', bare ? 'p-1' : 'p-1.5')}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
          onLoad={(e) => {
            // Hero windows render the logo LARGE — a tiny favicon upscaled to that
            // size is blurry mush. Prefer the next source / a crisp monogram.
            if (bare && e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth < 48) {
              setIdx((i) => i + 1);
              return;
            }
            if (!onColor) return;
            void import('@/lib/extractColor').then(({ extractDominantColor }) =>
              extractDominantColor(src).then((hex) => hex && onColor(hex)),
            );
          }}
        />
      ) : bare ? (
        // Designed lettermark plate — brand-colored initials + the full name,
        // so a missing logo still reads as an intentional card face.
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
