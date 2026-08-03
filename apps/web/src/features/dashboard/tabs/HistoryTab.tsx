import { useState } from 'react';
import { Quote } from 'lucide-react';
import { useCompany, useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { DigDeeper } from '@/features/deepdive/DeepDive';

export function HistoryTab({ companyId }: { companyId: string }) {
  const query = useDashboardTab(companyId, 'history');
  const name = useCompany(companyId).data?.name ?? 'this company';
  const [granularity, setGranularity] = useState<'all' | 'yearly' | 'quarterly'>('all');

  return (
    <QueryBoundary query={query}>
      {(result) => {
        const c = result.content;
        const paragraphs = c.founderStory.split(/\n\n+/).filter((x) => x.trim().length > 0);

        const filteredTimeline = c.timeline.filter((t) => {
          if (granularity === 'yearly') {
            return !/Q[1-4]|Quarter/i.test(t.date);
          }
          if (granularity === 'quarterly') {
            return /Q[1-4]|Quarter/i.test(t.date);
          }
          return true;
        });
        return (
          <div className="space-y-4">
            {/* The one-pager: the company's story, written to be read. */}
            {paragraphs.length > 0 && (
              <div className="panel p-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold text-content">The story</h3>
                  <div className="flex gap-2">
                    <DigDeeper topic="Founders & their backgrounds" companyId={companyId} companyName={name} />
                    <DigDeeper topic="Funding history & investors" companyId={companyId} companyName={name} />
                  </div>
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
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-content">Timeline</h3>
                  <div className="flex rounded-md bg-surface-2 p-0.5 text-xs">
                    <button
                      type="button"
                      className={`px-2 py-0.5 font-medium rounded ${granularity === 'all' ? 'bg-surface text-content shadow-sm' : 'text-muted hover:text-content'}`}
                      onClick={() => setGranularity('all')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-0.5 font-medium rounded ${granularity === 'yearly' ? 'bg-surface text-content shadow-sm' : 'text-muted hover:text-content'}`}
                      onClick={() => setGranularity('yearly')}
                    >
                      Yearly
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-0.5 font-medium rounded ${granularity === 'quarterly' ? 'bg-surface text-content shadow-sm' : 'text-muted hover:text-content'}`}
                      onClick={() => setGranularity('quarterly')}
                    >
                      Quarterly
                    </button>
                  </div>
                </div>

                <ol className="relative border-l-2 border-border pl-6">
                  {filteredTimeline.map((t, i) => (
                    <li key={i} className="relative mb-5 last:mb-0">
                      <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-primary shadow-sm" />
                      <div className="rounded-lg border border-border bg-surface-2/50 px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold tabular-nums text-primary-ink">{t.date}</span>
                          <DigDeeper
                            topic={`${t.title} (${t.date})`}
                            companyId={companyId}
                            companyName={name}
                            context={t.detail || null}
                            className="h-5 w-5"
                          />
                        </div>
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
