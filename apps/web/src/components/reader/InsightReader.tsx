/**
 * InsightReader — "company research as a deck of cards", applied to every
 * claim on a dashboard. A positive signal, a concern, a timeline milestone, a
 * roadmap item: click it and it opens as its own readable card — kicker, date,
 * the full text, and a grounded "Research this" path for the whole gist.
 */
import { CalendarDays, ThumbsDown, ThumbsUp, Milestone, Map as MapIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { DigDeeper } from '@/features/deepdive/DeepDive';
import { cn } from '@/lib/cn';

export type InsightTone = 'positive' | 'negative' | 'milestone' | 'roadmap';

const TONE: Record<
  InsightTone,
  { kicker: string; cls: string; Icon: typeof ThumbsUp }
> = {
  positive: { kicker: 'Positive signal', cls: 'text-positive border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30', Icon: ThumbsUp },
  negative: { kicker: 'Concern', cls: 'text-negative border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30', Icon: ThumbsDown },
  milestone: { kicker: 'Milestone', cls: 'text-primary-ink border-border bg-surface-2/60', Icon: Milestone },
  roadmap: { kicker: 'Roadmap', cls: 'text-primary-ink border-border bg-surface-2/60', Icon: MapIcon },
};

export function InsightReader({
  open,
  onClose,
  tone,
  title,
  date,
  body,
  companyId,
  companyName,
  researchSeed,
}: {
  open: boolean;
  onClose: () => void;
  tone: InsightTone;
  title: string;
  date?: string | null;
  /** The full text we have for this item — rendered to be read. */
  body: string | null;
  companyId: string;
  companyName: string;
  /** What the grounded research pass should chase for the whole gist. */
  researchSeed: string;
}) {
  if (!open) return null;
  const t = TONE[tone];
  return (
    <Modal
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={title}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest',
              t.cls,
            )}
          >
            <t.Icon className="h-3 w-3" />
            {t.kicker}
          </span>
          {date && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <CalendarDays className="h-3.5 w-3.5" />
              {date}
            </span>
          )}
        </div>

        {body && body.trim().length > 0 ? (
          <p className="text-sm leading-relaxed text-content/90">{body}</p>
        ) : (
          <p className="text-sm italic text-muted">
            The first research pass captured only the headline — pull the full story below.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="max-w-xs text-[11px] leading-relaxed text-faint">
            "Research this" runs a fresh grounded pass on exactly this item — sources, dates, and
            the full picture land in the research sheet.
          </p>
          <DigDeeper
            topic={title}
            companyId={companyId}
            companyName={companyName}
            context={researchSeed}
            label="Research this"
          />
        </div>
      </div>
    </Modal>
  );
}
