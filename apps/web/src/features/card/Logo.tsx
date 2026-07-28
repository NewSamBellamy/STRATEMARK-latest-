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
}: {
  name: string;
  website: string | null | undefined;
  className?: string;
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
        'game-card__logo grid shrink-0 place-items-center overflow-hidden rounded-xl font-display text-sm font-bold text-content',
        className,
      )}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={`${name} logo`}
          className="h-full w-full object-contain p-1.5"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        <span aria-label={`${name} monogram`}>{initials(name)}</span>
      )}
    </div>
  );
}
