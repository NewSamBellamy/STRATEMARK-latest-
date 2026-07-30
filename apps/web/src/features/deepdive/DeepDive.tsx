/**
 * Dig — the research conversation.
 *
 * Any data point, section, company, or set of selected cards can open a
 * grounded conversation in the right-hand sheet. This is the "second brain"
 * loop: every question an analyst asks becomes part of the deck's accumulated
 * intelligence — threads persist, reopen, and can be distilled into saved
 * reports. Two analysts researching the same market end up with different
 * decks because their questions differ.
 *
 * Grounding contract (non-negotiable): answers come from the deck's stored
 * research plus a fresh Google Search — never from model memory. The engine
 * side of that promise lives in CHAT_SYSTEM (packages/research).
 *
 * Transports that haven't wired conversations yet (the Electron IPC bridge)
 * fall back to the original one-shot deep dive, feature-detected at runtime.
 */
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  ExternalLink,
  FilePlus2,
  FileText,
  Loader2,
  Shovel,
  X,
} from 'lucide-react';
import { publisherOf, type Citation, type DeepDiveInput, type ResearchScope, type ResearchThread } from '@mi/contracts';
import { useRepository } from '@/lib/repository/RepositoryProvider';
import { cn } from '@/lib/cn';

interface ChatOptions {
  /** Ask this immediately on open (e.g. a Dig on a specific figure). */
  seed?: string;
  /** Placeholder for the composer when opening without a seed. */
  placeholder?: string;
}

interface DeepDiveContextValue {
  /** Legacy one-shot entry point — now opens a conversation seeded with the topic. */
  open: (input: DeepDiveInput) => void;
  /** Open a conversation anchored to a scope. */
  chat: (scope: ResearchScope, opts?: ChatOptions) => void;
  /** Reopen a saved thread with its history intact. */
  openThread: (threadId: string) => void;
}

const DeepDiveContext = createContext<DeepDiveContextValue | null>(null);

export function useDeepDive(): DeepDiveContextValue {
  const ctx = useContext(DeepDiveContext);
  if (!ctx) throw new Error('useDeepDive must be used within a DeepDiveProvider');
  return ctx;
}

function SourceChips({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {citations.slice(0, 6).map((c, i) => (
        <a
          key={i}
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] text-muted hover:border-primary/50 hover:text-primary-ink"
          title={c.url}
        >
          <ExternalLink className="h-2.5 w-2.5" />
          {publisherOf(c.url, c.title)}
        </a>
      ))}
      {citations.length > 6 && (
        <span className="text-[10.5px] text-faint">+{citations.length - 6} more</span>
      )}
    </div>
  );
}

export function DeepDiveProvider({ children }: { children: ReactNode }) {
  const repo = useRepository();
  const qc = useQueryClient();
  const conversational = typeof repo.askResearch === 'function';

  const [openState, setOpenState] = useState(false);
  const [scope, setScope] = useState<ResearchScope | null>(null);
  const [thread, setThread] = useState<ResearchThread | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState('');
  // Save-as-report affordance
  const [savingReport, setSavingReport] = useState(false);
  const [reportFocus, setReportFocus] = useState('');
  const [showReportForm, setShowReportForm] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    // jsdom (unit tests) has no scrollTo on elements — guard, don't polyfill.
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [thread?.messages.length, busy]);

  const reset = () => {
    setThread(null);
    setError(null);
    setShowReportForm(false);
    setReportFocus('');
    setDraft('');
  };

  const ask = async (question: string, forScope: ResearchScope | null, threadId?: string) => {
    if (!repo.askResearch) return;
    setBusy(true);
    setError(null);
    try {
      const t = await repo.askResearch(
        threadId ? { threadId, question } : { scope: forScope ?? undefined, question },
      );
      setThread(t);
      void qc.invalidateQueries({ queryKey: ['researchThreads'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const chat = (s: ResearchScope, opts?: ChatOptions) => {
    reset();
    setScope(s);
    setPlaceholder(opts?.placeholder);
    setOpenState(true);
    if (opts?.seed) void ask(opts.seed, s);
  };

  const openThread = (threadId: string) => {
    reset();
    setOpenState(true);
    setBusy(true);
    void repo
      .getResearchThread?.(threadId)
      .then((t) => {
        if (t) {
          setThread(t);
          setScope(t.scope);
        } else setError('That research thread was not found.');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  // Legacy one-shot inputs become seeded conversations.
  const open = (input: DeepDiveInput) => {
    const s: ResearchScope = {
      kind: input.companyId ? 'datapoint' : 'deck',
      deckId: null,
      companyId: input.companyId,
      subject: input.topic,
    };
    const seed = `${input.topic}${input.context ? ` — ${input.context}` : ''}${
      input.companyName ? ` (for ${input.companyName})` : ''
    }`;
    if (conversational) chat(s, { seed });
    else {
      // One-shot fallback for transports without conversations (Electron IPC,
      // until the desktop back end wires them).
      reset();
      setScope(s);
      setOpenState(true);
      setBusy(true);
      void repo
        .deepDive(input)
        .then((r) => {
          setThread({
            id: 'oneshot',
            scope: s,
            title: input.topic,
            messages: [
              { id: 'q', role: 'user', text: seed, citations: [], at: new Date().toISOString() },
              { id: 'a', role: 'assistant', text: r.markdown, citations: r.citations, at: new Date().toISOString() },
            ],
            reportId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setBusy(false));
    }
  };

  const close = () => setOpenState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q || busy) return;
    setDraft('');
    void ask(q, scope, thread && thread.id !== 'oneshot' ? thread.id : undefined);
  };

  const saveReport = async () => {
    if (!repo.saveThreadAsReport || !thread || thread.id === 'oneshot') return;
    setSavingReport(true);
    setError(null);
    try {
      const report = await repo.saveThreadAsReport(thread.id, reportFocus.trim() || null);
      setThread({ ...thread, reportId: report.id });
      setShowReportForm(false);
      void qc.invalidateQueries({ queryKey: ['reports'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingReport(false);
    }
  };

  // When closed, mark the whole overlay `inert` so its focusable children are
  // removed from the tab order + accessibility tree.
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (overlayRef.current) overlayRef.current.inert = !openState;
  }, [openState]);

  const scopeLabel =
    scope?.subject ??
    (scope?.kind === 'cards'
      ? `${scope.cardIds?.length ?? 0} selected cards`
      : scope?.kind === 'deck'
        ? 'This deck'
        : 'Research');
  const canConverse = conversational && thread?.id !== 'oneshot';
  const hasAnswer = (thread?.messages ?? []).some((m) => m.role === 'assistant');

  return (
    <DeepDiveContext.Provider value={{ open, chat, openThread }}>
      {children}

      <div
        ref={overlayRef}
        className={cn(
          'fixed inset-0 z-50 transition-opacity duration-200',
          openState ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={close} />
        <aside
          className={cn(
            'absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-border bg-surface shadow-card transition-transform duration-300',
            openState ? 'translate-x-0' : 'translate-x-full',
          )}
          role="dialog"
          aria-label="Deep dive"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-primary-ink">
                <Shovel className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Dig</span>
              </div>
              <h2 className="mt-1 truncate font-display text-lg font-semibold text-content">
                {thread?.title ?? scopeLabel}
              </h2>
              <p className="truncate text-xs text-muted">
                Grounded in this deck’s research + a fresh Google Search. Never training data.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {canConverse && hasAnswer && repo.saveThreadAsReport && !thread?.reportId && (
                <button
                  type="button"
                  onClick={() => setShowReportForm((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted hover:border-primary/50 hover:text-primary-ink"
                  title="Distill this conversation into a saved report"
                >
                  <FilePlus2 className="h-3.5 w-3.5" /> Save as report
                </button>
              )}
              {thread?.reportId && (
                <Link
                  to={`/reports/${thread.reportId}`}
                  onClick={close}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700"
                >
                  <FileText className="h-3.5 w-3.5" /> Report saved
                </Link>
              )}
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-content"
                aria-label="Close deep dive"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          {showReportForm && (
            <div className="border-b border-border bg-surface-2 px-5 py-3">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted" htmlFor="report-focus">
                What should the report concentrate on?
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="report-focus"
                  className="input flex-1 py-1.5 text-sm"
                  placeholder={thread?.title ?? 'e.g. who is winning enterprise'}
                  value={reportFocus}
                  onChange={(e) => setReportFocus(e.target.value)}
                />
                <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => void saveReport()} disabled={savingReport}>
                  {savingReport ? 'Composing…' : 'Create report'}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                The report folds in this conversation’s findings plus the deck’s stored evidence. It lands in Reports and on the company’s intel file.
              </p>
            </div>
          )}

          {/* Conversation */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {(thread?.messages ?? []).length === 0 && !busy && !error && (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted">
                <Shovel className="h-6 w-6 text-primary-ink" />
                <p className="max-w-sm text-sm">
                  Ask anything about <span className="font-medium text-content">{scopeLabel.toLowerCase()}</span>.
                  Every answer is grounded and cited; the thread is saved to this deck.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {(thread?.messages ?? []).map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/10 px-3.5 py-2 text-sm text-content">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="max-w-full">
                    <article className="markdown text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                    </article>
                    <SourceChips citations={m.citations} />
                  </div>
                ),
              )}
            </div>

            {busy && (
              <div className="flex items-center gap-2 py-6 text-muted">
                <Loader2 className="h-4 w-4 animate-spin text-primary-ink" />
                <span className="text-sm">Running a grounded search…</span>
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-lg border border-negative/40 bg-negative/10 p-3 text-sm text-negative">
                {error}
              </div>
            )}
          </div>

          {/* Composer */}
          {conversational && (
            <form onSubmit={submit} className="border-t border-border px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  className="input max-h-32 min-h-[42px] flex-1 resize-none py-2.5 text-sm"
                  rows={1}
                  placeholder={placeholder ?? 'Ask a follow-up…'}
                  aria-label="Ask a research question"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="btn-primary h-[42px] w-[42px] shrink-0 !p-0"
                  disabled={!draft.trim() || busy}
                  aria-label="Send question"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </aside>
      </div>
    </DeepDiveContext.Provider>
  );
}

/**
 * The shovel — the universal "dig deeper" affordance. Icon-only by design:
 * it appears beside data points everywhere, so it has to be quiet.
 */
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
  /** Accessible name; not rendered visually. */
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
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:border-primary/50 hover:text-primary-ink',
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Shovel className="h-3 w-3" />
    </button>
  );
}
