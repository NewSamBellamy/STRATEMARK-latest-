import { Link } from 'react-router-dom';
import { FileText, ArrowRight } from 'lucide-react';
import { useReports } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { EmptyState } from '@/components/states/EmptyState';
import { formatRelative } from '@/lib/format';

export default function ReportsListPage() {
  const reports = useReports();
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-semibold text-content">Reports</h1>
      <p className="mt-1 text-sm text-muted">
        AI-composed research reports, built from your decks’ sourced evidence. Everything stays
        organized here.
      </p>

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
                        <span className="chip border-border text-muted capitalize">{r.kind}</span>
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
