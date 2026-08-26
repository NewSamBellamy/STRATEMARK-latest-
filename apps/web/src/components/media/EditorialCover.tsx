/**
 * Editorial cover — the DEFAULT article imagery for Live Intel.
 *
 * Live page captures kept hitting bot walls: the "article image" was a
 * CAPTCHA screenshot, which is worse than nothing. This cover is composed
 * from what we actually know about the story — publisher favicon (real),
 * source type, headline — over a deterministic palette derived from the
 * publisher, so every story gets a clean newsletter-style visual that always
 * "fits the article" and can never be a CAPTCHA. Zero network, zero cost.
 */
import { Hash, MessageSquare, Newspaper } from 'lucide-react';
import { publisherOf } from '@mi/contracts';
import { faviconUrl } from '@/lib/screenshot';
import { cn } from '@/lib/cn';

const SOURCE_ICON = { news: Newspaper, x: Hash, reddit: MessageSquare } as const;

/** Curated duotone palettes — editorial, not neon. */
const PALETTES: Array<[string, string]> = [
  ['#0F3D3E', '#14B8A6'], // deep teal
  ['#1E2749', '#6366F1'], // indigo night
  ['#3B2F2F', '#D97706'], // umber amber
  ['#14342B', '#10B981'], // forest emerald
  ['#2D1B3D', '#A855F7'], // plum
  ['#1F2937', '#38BDF8'], // slate sky
  ['#3F2021', '#F43F5E'], // oxblood rose
  ['#243B2F', '#84CC16'], // moss lime
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function EditorialCover({
  title,
  url,
  source,
  compact = false,
  className,
}: {
  title: string;
  url: string;
  source: 'news' | 'x' | 'reddit';
  /** Row thumbnail (tiny type) vs reader hero (full masthead treatment). */
  compact?: boolean;
  className?: string;
}) {
  const publisher = publisherOf(url, null);
  const [deep, accent] = PALETTES[hashCode(publisher || title) % PALETTES.length]!;
  const Icon = SOURCE_ICON[source];
  const hasRealUrl = /^https?:\/\//.test(url) && !/vertexaisearch|grounding-api-redirect/i.test(url);

  return (
    <div
      className={cn('relative flex h-full w-full flex-col justify-between overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, ${deep} 0%, ${deep} 55%, ${accent} 160%)` }}
      aria-hidden
    >
      {/* Quiet texture: an oversized ghost glyph anchored off-corner. */}
      <Icon
        className="absolute -bottom-3 -right-3 opacity-[0.14]"
        style={{ color: accent, width: compact ? 56 : 120, height: compact ? 56 : 120 }}
        strokeWidth={1.2}
      />
      <div className={cn('flex items-center gap-1.5', compact ? 'p-2' : 'p-4')}>
        {hasRealUrl && (
          <img src={faviconUrl(url)} alt="" className={compact ? 'h-3 w-3 rounded-sm' : 'h-4 w-4 rounded-sm'} />
        )}
        <span
          className={cn(
            'truncate font-semibold uppercase tracking-widest text-white/70',
            compact ? 'text-[7px]' : 'text-[10px]',
          )}
        >
          {publisher}
        </span>
      </div>
      <p
        className={cn(
          'font-display font-semibold leading-snug text-white',
          compact ? 'line-clamp-3 px-2 pb-2 text-[9px]' : 'line-clamp-3 px-4 pb-4 text-lg',
        )}
      >
        {title}
      </p>
    </div>
  );
}
