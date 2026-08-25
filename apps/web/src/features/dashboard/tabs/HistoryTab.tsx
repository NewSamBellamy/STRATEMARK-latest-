import { Quote } from 'lucide-react';
import { useCompany, useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { History } from 'lucide-react';
import { DigDeeperMenu } from '@/features/deepdive/DeepDive';
import { useRerunDashboardTab } from '@/hooks/data';

export function HistoryTab({ companyId }: { companyId: string }) {
  const expand = useRerunDashboardTab(companyId, 'history');
  const query = useDashboardTab(companyId, 'history');
  const name = useCompany(companyId).data?.name ?? 'this company';
  return (
    <QueryBoundary query={query}>
      {(result) => {
        const c = result.content;
        const paragraphs = c.founderStory.split(/\n\n+/).filter((x) => x.trim().length > 0);
        return (
          <div className="space-y-4">
            {/* The one-pager: the company's story, written to be read. */}
            {paragraphs.length > 0 && (
              <div className="panel p-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold text-content">The story</h3>
                  <DigDeeperMenu
                    topics={['Founders & their backgrounds', 'Funding history & investors']}
                    companyId={companyId}
                    companyName={name}
                  />
                </div>
                <div className="max-w-3xl space-y-3">
                  {paragraphs.map((para, i) => (
                    <p key={i} className="text-[15px] leading-relaxed text-content/90">
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              {/* A story in time: the rail keeps scrolling as research adds to it. */}
              <div className="panel p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-display text-sm font-semibold text-content">Timeline</h3>
                  {/* The timeline never has to stop: one click sends the desk
                      back out for a denser pass — month-level recency, every
                      product release it can source. */}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-primary/50 hover:text-primary-ink disabled:opacity-60"
                    disabled={expand.isPending}
                    onClick={() => expand.mutate()}
                    title="Re-research the timeline for a denser pass — month-level recent history, every sourced release"
                  >
                    <History className={expand.isPending ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
                    {expand.isPending ? 'Expanding…' : 'Expand timeline'}
                  </button>
                </div>
                <ol className="relative border-l-2 border-border pl-6">
                  {c.timeline.map((t, i) => (
                    <li key={i} className="relative mb-5 last:mb-0">
                      <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-primary shadow-sm" />
                      <div className="rounded-lg border border-border bg-surface-2/50 px-3.5 py-2.5">
                        <span className="text-xs font-bold tabular-nums text-primary-ink">{t.date}</span>
                        <div className="text-sm font-medium text-content">{t.title}</div>
                        {t.detail && <div className="mt-0.5 text-sm text-muted">{t.detail}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="panel h-fit p-5">
                <h3 className="font-display text-sm font-semibold text-content">Notable quotes</h3>
                <ul className="mt-3 space-y-4">
                  {c.quotes.map((q, i) => (
                    <li key={i} className="text-sm">
                      <Quote className="h-4 w-4 text-muted" />
                      <p className="mt-1 italic text-content">{q.text}</p>
                      {q.attribution && <p className="mt-1 text-xs text-muted">— {q.attribution}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
