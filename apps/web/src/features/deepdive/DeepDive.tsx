/**
 * "Dig deeper" — the research-intuitive drill-down. Any metric, section, or
 * company can open a grounded, sourced deep-dive in a right-hand sheet without
 * leaving the page. This is what makes the app feel like a research tool:
 * everything is expandable, and every expansion is cited.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Search, X, ExternalLink, Sparkles } from 'lucide-react';
import type { DeepDiveInput } from '@mi/contracts';
import { useRepository } from '@/lib/repository/RepositoryProvider';
import { cn } from '@/lib/cn';

interface DeepDiveContextValue {
  open: (input: DeepDiveInput) => void;
}
const DeepDiveContext = createContext<DeepDiveContextValue | null>(null);

export function useDeepDive(): DeepDiveContextValue {
  const ctx = useContext(DeepDiveContext);
  if (!ctx) throw new Error('useDeepDive must be used within a DeepDiveProvider');
  return ctx;
}

export function DeepDiveProvider({ children }: { children: ReactNode }) {
  const repo = useRepository();
  const [input, setInput] = useState<DeepDiveInput | null>(null);

  const query = useQuery({
    queryKey: ['deepDive', input?.companyId, input?.topic, input?.context],
    queryFn: () => repo.deepDive(input!),
    enabled: !!input,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });

  const close = () => setInput(null);

  // When closed, mark the whole overlay `inert` so its focusable children (close
  // button, links) are removed from the tab order + accessibility tree — fixes
  // the aria-hidden-focus violation without losing the slide transition.
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (overlayRef.current) overlayRef.current.inert = !input;
  }, [input]);

  return (
    <DeepDiveContext.Provider value={{ open: setInput }}>
      {children}

      {/* Backdrop + right sheet */}
      <div
        ref={overlayRef}
        className={cn(
          'fixed inset-0 z-50 transition-opacity duration-200',
          input ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={close} />
        <aside
          className={cn(
            'absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col border-l border-border bg-surface shadow-card transition-transform duration-300',
            input ? 'translate-x-0' : 'translate-x-full',
          )}
          role="dialog"
          aria-label="Deep dive"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-primary-ink">
                <Search className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Deep dive</span>
              </div>
              <h2 className="mt-1 truncate font-display text-lg font-semibold text-content">
                {input?.topic}
              </h2>
              {input?.companyName && (
                <p className="truncate text-sm text-muted">{input.companyName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-content"
              aria-label="Close deep dive"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {query.isPending && input && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
                <Loader2 className="h-6 w-6 animate-spin text-primary-ink" />
                <p className="text-sm">Researching {input.topic.toLowerCase()}…</p>
                <p className="max-w-xs text-center text-xs">
                  Running a grounded Google-Search pass. A few seconds.
                </p>
              </div>
            )}
            {query.isError && (
              <div className="rounded-lg border border-negative/40 bg-negative/10 p-4 text-sm text-negative">
                Couldn’t complete the deep dive. {String((query.error as Error)?.message ?? '')}
              </div>
            )}
            {query.data && (
              <>
                <article className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{query.data.markdown}</ReactMarkdown>
                </article>
                {query.data.citations.length > 0 && (
                  <div className="mt-6 border-t border-border pt-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      Sources ({query.data.citations.length})
                    </h3>
                    <ul className="space-y-1.5">
                      {query.data.citations.map((c, i) => (
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
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </DeepDiveContext.Provider>
  );
}

/** Reusable "Dig deeper" trigger. */
export function DigDeeper({
  topic,
  companyId,
  companyName,
  context,
  className,
  label = 'Dig deeper',
}: {
  topic: string;
  companyId: string | null;
  companyName: string;
  context?: string | null;
  className?: string;
  label?: string;
}) {
  const { open } = useDeepDive();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open({ topic, companyId, companyName, context: context ?? null });
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted transition-colors hover:border-primary/50 hover:text-primary-ink',
        className,
      )}
    >
      <Sparkles className="h-3 w-3" />
      {label}
    </button>
  );
}
