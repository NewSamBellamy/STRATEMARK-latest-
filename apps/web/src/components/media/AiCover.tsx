/**
 * AiCover — nano-banana generated article imagery with an honest fallback.
 *
 * Shows the AI-generated cover (prompted from the story's own research) the
 * moment it's ready; until then — and on transports without a key — the
 * designed editorial cover holds the frame, so the layout never flashes or
 * breaks. A tiny "AI" chip marks generated imagery as generated.
 */
import { Sparkles } from 'lucide-react';
import { useAiCover } from '@/lib/ai/aiCover';
import { EditorialCover } from './EditorialCover';
import { cn } from '@/lib/cn';

export function AiCover({
  cacheKey,
  title,
  context,
  url,
  source,
  compact = false,
  className,
}: {
  cacheKey: string;
  title: string;
  /** Reported detail/summary — the research the prompt is built from. */
  context: string | null;
  url: string;
  source: 'news' | 'x' | 'reddit';
  compact?: boolean;
  className?: string;
}) {
  const generated = useAiCover(cacheKey, title, context);
  if (!generated) {
    return (
      <EditorialCover title={title} url={url} source={source} compact={compact} className={className} />
    );
  }
  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <img src={generated} alt="" className="h-full w-full object-cover" />
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
