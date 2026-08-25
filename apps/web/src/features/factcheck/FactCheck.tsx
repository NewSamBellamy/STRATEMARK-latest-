/**
 * Inline grounded fact-check. Sits next to any claim/figure; on click it runs a
 * live Google-Search verification and renders a verdict pill + rationale +
 * sources in place — the "always be able to fact-check" affordance.
 *
 * When the claim IS a stored metric (companyId + metricType provided) a
 * contradiction is no longer a dead end: the verdict carries the corrected
 * figure, and one click applies it through the repository's live-verification
 * write path — the value revises with citations, the company re-tiers, and
 * every open view updates. A fact-check that can't fix anything is a smoke
 * detector without a bell.
 */
import { useState } from 'react';
import {
  CheckCheck,
  ExternalLink,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Wand2,
} from 'lucide-react';
import type { FactCheckResult, FactCheckVerdict, MetricType } from '@mi/contracts';
import { useFactCheck, useVerifyMetric } from '@/hooks/data';
import { formatMetricValue } from '@/lib/format';
import { cn } from '@/lib/cn';

const VERDICT_STYLE: Record<FactCheckVerdict, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  supported: { label: 'Supported', cls: 'border-emerald-300 bg-emerald-50 text-emerald-800', Icon: ShieldCheck },
  contradicted: { label: 'Contradicted', cls: 'border-rose-300 bg-rose-50 text-rose-800', Icon: ShieldAlert },
  unverified: { label: 'Unverified', cls: 'border-slate-300 bg-slate-100 text-slate-700', Icon: ShieldQuestion },
};

export function FactCheck({
  claim,
  companyName,
  context,
  companyId,
  metricType,
  storedValue,
  className,
}: {
  claim: string;
  companyName: string | null;
  context?: string | null;
  /** Present when the claim is a stored metric — unlocks one-click correction. */
  companyId?: string | null;
  metricType?: MetricType | null;
  storedValue?: number | null;
  className?: string;
}) {
  const factCheck = useFactCheck();
  const verify = useVerifyMetric();
  const [result, setResult] = useState<FactCheckResult | null>(null);
  const [applied, setApplied] = useState(false);

  const run = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (factCheck.isPending) return;
    factCheck.mutate(
      {
        claim,
        companyName,
        context: context ?? null,
        companyId: companyId ?? null,
        metricType: metricType ?? null,
        storedValue: storedValue ?? null,
      },
      { onSuccess: setResult },
    );
  };

  const metricAnchored = !!companyId && !!metricType && verify.isAvailable && !applied;
  const canApply =
    result?.verdict === 'contradicted' && result.correctedValue != null && metricAnchored;
  // A check that can't corroborate the stored figure must be able to fix the
  // badge — otherwise the metric keeps wearing "Verified" right next to an
  // assessment saying "Unverified" (the two-truth-systems contradiction).
  const canReconcile = result?.verdict === 'unverified' && metricAnchored;

  const apply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!companyId || !metricType || verify.isPending) return;
    // The reconciliation ran either way: a correction wrote back, a downgrade
    // wrote back, or fresh evidence re-confirmed the badge. All three resolve
    // the on-screen disagreement.
    verify.mutate({ companyId, metricType }, { onSuccess: () => setApplied(true) });
  };

  if (result) {
    const v = VERDICT_STYLE[result.verdict];
    return (
      <div className={cn('rounded-lg border border-border bg-surface-2 p-2.5 text-left', className)}>
        <span className={cn('chip', v.cls)}>
          <v.Icon className="h-3.5 w-3.5" />
          {v.label}
        </span>
        {result.rationale && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{result.rationale}</p>
        )}
        {canApply && metricType && (
          <button
            type="button"
            onClick={apply}
            disabled={verify.isPending}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            {verify.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            {verify.isPending
              ? 'Verifying & updating…'
              : `Verify & correct to ${formatMetricValue(metricType, result.correctedValue!)}`}
          </button>
        )}
        {canReconcile && (
          <button
            type="button"
            onClick={apply}
            disabled={verify.isPending}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          >
            {verify.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            {verify.isPending ? 'Re-verifying…' : 'Re-verify & update the badge'}
          </button>
        )}
        {result.verdict === 'supported' && metricType && (
          <p className="mt-1.5 text-[11px] font-medium text-positive">
            Confirms the stored figure.
          </p>
        )}
        {applied && (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-positive">
            <CheckCheck className="h-3.5 w-3.5" />
            Reconciled from live sources — badge, card, and tier updated.
          </p>
        )}
        {result.citations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {result.citations.slice(0, 4).map((c, i) => (
              <a
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary-ink hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                {c.title || 'source'}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={factCheck.isPending}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted transition-colors hover:border-primary/50 hover:text-primary-ink disabled:opacity-60',
        className,
      )}
    >
      {factCheck.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ShieldQuestion className="h-3 w-3" />
      )}
      {factCheck.isPending ? 'Checking…' : 'Fact-check'}
    </button>
  );
}
