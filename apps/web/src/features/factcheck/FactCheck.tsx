/**
 * Inline grounded fact-check. Sits next to any claim/figure; on click it runs a
 * live Google-Search verification and renders a verdict pill + rationale +
 * sources in place — the "always be able to fact-check" affordance.
 */
import { useState } from 'react';
import { ExternalLink, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { FactCheckResult, FactCheckVerdict } from '@mi/contracts';
import { useFactCheck } from '@/hooks/data';
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
  className,
}: {
  claim: string;
  companyName: string | null;
  context?: string | null;
  className?: string;
}) {
  const factCheck = useFactCheck();
  const [result, setResult] = useState<FactCheckResult | null>(null);

  const run = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (factCheck.isPending) return;
    factCheck.mutate(
      { claim, companyName, context: context ?? null },
      { onSuccess: setResult },
    );
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
