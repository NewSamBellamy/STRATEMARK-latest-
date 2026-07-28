import { BadgeCheck, CircleHelp, Sigma, UserCheck } from 'lucide-react';
import type { Confidence } from '@mi/contracts';
import { CONFIDENCE_LABELS } from '@mi/contracts';
import { cn } from '@/lib/cn';
import { CONFIDENCE_STYLES } from '@/lib/format';
import { Tooltip } from '@/components/ui/Tooltip';

const ICON = {
  verified: BadgeCheck,
  estimated: Sigma,
  unknown: CircleHelp,
  user_verified: UserCheck,
} as const;

export function ConfidenceBadge({
  confidence,
  note,
  source,
}: {
  confidence: Confidence;
  note?: string | null;
  source?: string | null;
}) {
  const Icon = ICON[confidence];
  const tip =
    confidence === 'verified'
      ? (source ?? 'Sourced from a disclosed/public figure.')
      : confidence === 'estimated'
        ? (note ?? 'Estimated from indirect signals via a stated method.')
        : confidence === 'user_verified'
          ? (note ?? 'Manually corrected by you — treated as ground truth for scoring.')
          : 'No usable signal found — shown as Unknown (never scored as zero).';
  return (
    <Tooltip content={tip}>
      <span
        className={cn('chip cursor-help', CONFIDENCE_STYLES[confidence])}
        aria-label={`Confidence: ${CONFIDENCE_LABELS[confidence]}. ${tip}`}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {CONFIDENCE_LABELS[confidence]}
      </span>
    </Tooltip>
  );
}
