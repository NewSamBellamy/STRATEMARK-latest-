import { Quote } from 'lucide-react';
import { useCompany, useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { DigDeeper } from '@/features/deepdive/DeepDive';

export function HistoryTab({ companyId }: { companyId: string }) {
  const query = useDashboardTab(companyId, 'history');
  const name = useCompany(companyId).data?.name ?? 'this company';
  return (
    <QueryBoundary query={query}>
      {(result) => {
        const c = result.content;
        return (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="panel p-5">
                <h3 className="font-display text-sm font-semibold text-content">Founder story</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.founderStory}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <DigDeeper topic="Founders & their backgrounds" companyId={companyId} companyName={name} />
                  <DigDeeper topic="Funding history & investors" companyId={companyId} companyName={name} />
                </div>
              </div>

              <div className="panel p-5">
                <h3 className="mb-4 font-display text-sm font-semibold text-content">Timeline</h3>
                <ol className="relative border-l border-border pl-5">
                  {c.timeline.map((t, i) => (
                    <li key={i} className="mb-5 last:mb-0">
                      <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2 border-bg bg-primary" />
                      <div className="text-xs font-semibold text-primary-ink">{t.date}</div>
                      <div className="text-sm font-medium text-content">{t.title}</div>
                      <div className="text-sm text-muted">{t.detail}</div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="panel h-fit p-5">
              <h3 className="font-display text-sm font-semibold text-content">Notable quotes</h3>
              <ul className="mt-3 space-y-4">
                {c.quotes.map((q, i) => (
                  <li key={i} className="text-sm">
                    <Quote className="h-4 w-4 text-muted" />
                    <p className="mt-1 italic text-content">{q.text}</p>
                    <p className="mt-1 text-xs text-muted">— {q.attribution}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
