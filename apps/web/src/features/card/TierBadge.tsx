import type { MaturityTier } from '@mi/contracts';
import { TIER_BLURBS, TIER_LABELS } from '@mi/contracts';
import { cn } from '@/lib/cn';
import { TIER_COLORS, tint } from '@/lib/theme';
import { Tooltip } from '@/components/ui/Tooltip';

/**
 * Tier badge — a colored pill. The hue is the tier color; text stays near-black
 * (AA-safe) with a colored dot + tinted background for the "pop of color".
 */
export function TierBadge({
  tier,
  reason,
  size = 'sm',
  compact = false,
}: {
  tier: MaturityTier;
  reason?: string | null;
  size?: 'sm' | 'md';
  compact?: boolean;
}) {
  const color = TIER_COLORS[tier];
  const content = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold text-content',
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs',
      )}
      style={{ background: tint(color, 0.1), borderColor: tint(color, 0.3) }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="tabular-nums opacity-70">T{tier}</span>
      {!compact && TIER_LABELS[tier]}
    </span>
  );
  const tip = reason ? `${TIER_BLURBS[tier]}. Review note: ${reason}` : TIER_BLURBS[tier];
  return <Tooltip content={tip}>{content}</Tooltip>;
}
