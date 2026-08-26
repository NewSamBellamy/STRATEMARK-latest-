import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, ClipboardCheck, Loader2 } from 'lucide-react';
import { useAuditSite, useReports } from '@/hooks/data';
import { useRepository } from '@/lib/repository/RepositoryProvider';
import { useApiKey } from '@/lib/settings/apiKey';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { EmptyState } from '@/components/states/EmptyState';
import { formatRelative } from '@/lib/format';

const KIND_LABEL: Record<string, string> = {
  deck: 'market',
  company: 'company',
  site_audit: 'site audit',
};

/**
 * Audit ANY website — yours or a competitor's — straight from the library.
 * This is the standalone entry to the teardown feature; company dashboards
 * have their own one-click version on the Live Landing tab.
 */
function AuditAnySite() {
  const repo = useRepository();
  const hasKey = useApiKey((st) => st.hasKey);
  const audit = useAuditSite();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  if (typeof repo.auditSite !== 'function' || !hasKey) return null;
  const run = () => {
    const trimmed = url.trim();
    if (!trimmed || audit.isPending) return;
    audit.mutate(
      { url: trimmed },
      { onSuccess: (r) => navigate(`/reports/${r.id}`) },
    );
  };
  return (
    <div className="panel mt-6 p-5">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary-ink" />
        <h2 className="font-display text-base font-semibold text-content">Audit a website</h2>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        A CRO/UX teardown of any landing page — your own site or a competitor's: scorecard, what's
        working, what's missing (and what each gap costs), the design language, and what to test
        first. Screenshots included, exportable as PDF.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          className="input flex-1 py-2 text-sm"
          placeholder="yoursite.com — or a competitor's"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run();
          }}
          disabled={audit.isPending}
        />
        <button
          type="button"
          className="btn-primary shrink-0"
          disabled={!url.trim() || audit.isPending}
          onClick={run}
          title="One grounded research pass on your key (typically a fraction of a cent)"
        >
          {audit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          {audit.isPending ? 'The auditor is on it…' : 'Run the audit'}
        </button>
      </div>
      {audit.isError && (
        <p className="mt-2 text-[12px] text-negative">
          {audit.error instanceof Error ? audit.error.message : 'The audit failed — try again.'}
        </p>
      )}
    </div>
  );
}

export default function ReportsListPage() {
  const reports = useReports();
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold text-content">Reports</h1>
      <p className="mt-1 text-sm text-muted">
        AI-composed research reports, built from your decks’ sourced evidence. Everything stays
        organized here.
      </p>

      <AuditAnySite />

      <div className="mt-6">
        <QueryBoundary
          query={reports}
          isEmpty={(list) => list.length === 0}
          empty={
            <EmptyState
              title="No reports yet"
              description="Open any deck or company dashboard and hit “Report” — the AI composes an executive-ready, cited report from your researched evidence."
              icon={<FileText className="h-6 w-6" />}
            />
          }
        >
          {(list) => (
            <ul className="space-y-3">
              {list.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/reports/${r.id}`}
                    className="panel group flex items-center justify-between gap-4 p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="chip border-border text-muted capitalize">{KIND_LABEL[r.kind] ?? r.kind}</span>
                        <h2 className="truncate font-display text-base font-semibold text-content">
                          {r.title}
                        </h2>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {formatRelative(r.createdAt)} · {r.citations.length} sources
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </div>
    </div>
  );
}
