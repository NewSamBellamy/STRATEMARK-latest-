import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { useReport } from '@/hooks/data';
import { QueryBoundary } from '@/components/states/QueryBoundary';
import { formatRelative } from '@/lib/format';

export default function ReportViewerPage() {
  const { reportId } = useParams();
  const report = useReport(reportId);

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-content">
        <ArrowLeft className="h-4 w-4" />
        Reports
      </Link>

      <QueryBoundary query={report}>
        {(r) => (
          <article className="panel p-6">
            <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <h1 className="font-display text-2xl font-semibold text-content">{r.title}</h1>
                <p className="mt-1 text-xs text-muted">
                  Generated {formatRelative(r.createdAt)} · {r.citations.length} sources
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  const blob = new Blob([`# ${r.title}\n\n${r.markdown}`], {
                    type: 'text/markdown',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${r.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4" />
                Download .md
              </button>
            </header>

            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.markdown}</ReactMarkdown>
            </div>

            {r.citations.length > 0 && (
              <footer className="mt-6 border-t border-border pt-4">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Sources ({r.citations.length})
                </h2>
                <ul className="space-y-1.5">
                  {r.citations.map((c, i) => (
                    <li key={i}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1.5 text-xs text-primary-ink hover:underline"
                      >
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-1">{c.title || c.url}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </footer>
            )}
          </article>
        )}
      </QueryBoundary>
    </div>
  );
}
