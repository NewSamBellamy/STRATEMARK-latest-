import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, MapPin } from 'lucide-react';
import { METRIC_TYPE_LABELS } from '@mi/contracts';
import { useCompany, useCompanyMetrics, useDashboardTab } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { formatMetricValue } from '@/lib/format';
import { METRIC_COLORS } from '@/lib/theme';
import { DigDeeper } from '@/features/deepdive/DeepDive';

/**
 * Overview — the "front page" of a company. A readable grounded summary plus an
 * at-a-glance fact rail, with drill-downs so any thread can be pulled further.
 */
export function OverviewTab({ companyId }: { companyId: string }) {
  const query = useDashboardTab(companyId, 'overview');
  const company = useCompany(companyId).data;
  const metrics = useCompanyMetrics(companyId).data ?? [];
  const name = company?.name ?? 'this company';

  return (
    <QueryBoundary query={query}>
      {(result) => (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <article className="markdown panel p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.content.markdown}</ReactMarkdown>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <DigDeeper topic="Business model & how they make money" companyId={companyId} companyName={name} />
              <DigDeeper topic="Competitive landscape & closest rivals" companyId={companyId} companyName={name} />
              <DigDeeper topic="Risks & headwinds" companyId={companyId} companyName={name} />
            </div>
          </article>

          <aside className="space-y-4">
            <div className="panel p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                At a glance
              </h3>
              <ul className="space-y-2.5">
                {metrics.slice(0, 6).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-muted">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: METRIC_COLORS[m.metricType] }}
                      />
                      {METRIC_TYPE_LABELS[m.metricType]}
                    </span>
                    <span className="font-semibold tabular-nums text-content">
                      {formatMetricValue(m.metricType, m.value)}
                    </span>
                  </li>
                ))}
                {metrics.length === 0 && (
                  <li className="text-sm text-muted">No quantitative metrics found.</li>
                )}
              </ul>
            </div>

            {company && (
              <div className="panel space-y-2 p-4 text-sm">
                {company.hqLocation && (
                  <p className="flex items-start gap-2 text-muted">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {company.hqLocation}
                  </p>
                )}
                {company.websiteUrl && (
                  <a
                    href={company.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary-ink hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {company.websiteUrl.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </QueryBoundary>
  );
}
