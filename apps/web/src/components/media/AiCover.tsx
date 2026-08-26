/**
 * AiCover — nano-banana generated article imagery with an honest fallback.
 *
 * Shows the AI-generated cover (prompted from the story's own research) the
 * moment it's ready; until then — and on transports without a key — the
 * designed editorial cover holds the frame, so the layout never flashes or
 * breaks. A tiny "AI" chip marks generated imagery as generated, and a
 * subtle re-spin control (hover, top-right) regenerates a take you don't
 * like — the ONLY path that ever re-bills an existing image.
 *
 * Aspect is explicit: wide panels get true 16:9 generations, thumbs 4:3 —
 * no more square images cropped into letterboxes.
 */
import { RefreshCw, Sparkles } from 'lucide-react';
import { useApiKey } from '@/lib/settings/apiKey';
import { useAiCover, type CoverAspect } from '@/lib/ai/aiCover';
import { EditorialCover } from './EditorialCover';
import { cn } from '@/lib/cn';

export function AiCover({
  cacheKey,
  title,
  context,
  url,
  source,
  compact = false,
  aspect,
  className,
}: {
  cacheKey: string;
  title: string;
  /** Reported detail/summary — the research the prompt is built from. */
  context: string | null;
  url: string;
  source: 'news' | 'x' | 'reddit';
  compact?: boolean;
  /** Generated shape; defaults to the surface's natural shape. */
  aspect?: CoverAspect;
  className?: string;
}) {
  const shape: CoverAspect = aspect ?? (compact ? '4:3' : '16:9');
  const { url: generated, respinning, respin } = useAiCover(cacheKey, title, context, shape);
  const hasKey = useApiKey((s) => s.hasKey);
  if (!generated) {
    return (
      <EditorialCover title={title} url={url} source={source} compact={compact} className={className} />
    );
  }
  return (
    <div className={cn('group/aicover relative h-full w-full overflow-hidden', className)}>
      <img
        src={generated}
        alt=""
        className={cn('h-full w-full object-cover', respinning && 'opacity-60')}
      />
      {/* Re-spin: subtle, hover-revealed, owner-key only. */}
      {hasKey && !compact && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            respin();
          }}
          disabled={respinning}
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white/90 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/60 group-hover/aicover:opacity-100"
          title="Re-spin this image — generates a fresh take (one image call on your key)"
        >
          <RefreshCw className={cn('h-3 w-3', respinning && 'animate-spin')} />
        </button>
      )}
      <span
        className={cn(
          'absolute flex items-center gap-0.5 rounded-full bg-black/45 font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm',
          compact ? 'bottom-1 right-1 px-1 py-px text-[6px]' : 'bottom-2 right-2 px-1.5 py-0.5 text-[9px]',
        )}
        title="Generated illustration (Gemini image model), prompted from this story's research — not a photograph."
      >
        <Sparkles className={compact ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5'} />
        AI
      </span>
    </div>
  );
}
