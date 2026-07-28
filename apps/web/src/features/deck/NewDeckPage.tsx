import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe2, KeyRound, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useRepository } from '@/lib/repository/RepositoryProvider';
import { useApiKey } from '@/lib/settings/apiKey';

interface LogLine {
  message: string;
  kind: 'step' | 'find' | 'warn';
  at: number;
}

/** Glass-box terminal: the agent's real research steps, streamed live. */
function ResearchTerminal({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [lines.length]);
  const color = (k: LogLine['kind']) =>
    k === 'find' ? 'text-emerald-300' : k === 'warn' ? 'text-amber-300' : 'text-sky-300';
  const prefix = (k: LogLine['kind']) => (k === 'find' ? '✓' : k === 'warn' ? '!' : '▸');
  return (
    <div
      ref={ref}
      className="mt-4 h-56 overflow-y-auto rounded-xl bg-[#12141A] p-3.5 font-mono text-[12px] leading-relaxed"
      aria-live="polite"
      aria-label="Live research log"
    >
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2">
          <span className={color(l.kind)}>{prefix(l.kind)}</span>
          <span className={l.kind === 'find' ? 'text-neutral-100' : 'text-neutral-400'}>
            {l.message}
          </span>
        </div>
      ))}
      <div className="mt-1 flex gap-2 text-neutral-500">
        <span className="animate-pulse">▮</span>
      </div>
    </div>
  );
}

const EXAMPLES = [
  'Christian apparel companies',
  'AI code-review startups',
  'Non-alcoholic spirits brands',
  'Precision fermentation companies',
];

export default function NewDeckPage() {
  const repo = useRepository();
  const navigate = useNavigate();
  const hasKey = useApiKey((s) => s.hasKey);

  const [prompt, setPrompt] = useState('');
  const [region, setRegion] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ message: string; pct: number }>({ message: '', pct: 0 });
  const [log, setLog] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || running) return;
    setError(null);
    setRunning(true);
    setLog([{ message: `New research brief: "${prompt.trim()}"${region.trim() ? ` · ${region.trim()}` : ''}`, kind: 'step', at: Date.now() }]);
    setProgress({ message: 'Starting…', pct: 0.02 });
    try {
      const { market } = await repo.createResearchedDeck(
        { prompt: prompt.trim(), region: region.trim() || null },
        {
          onProgress: (p) => {
            setProgress((prev) => ({ message: p.message, pct: p.progress ?? prev.pct }));
            setLog((prev) => [...prev, { message: p.message, kind: p.kind ?? 'step', at: Date.now() }]);
          },
        },
      );
      navigate(`/markets/${market.id}/deck`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed. Check your API key and try again.');
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2 text-primary-ink">
        <Wand2 className="h-5 w-5" />
        <span className="text-sm font-medium uppercase tracking-wide">New deck</span>
      </div>
      <h1 className="font-display text-3xl font-semibold text-content">
        What market should we map?
      </h1>
      <p className="mt-2 text-muted">
        Describe a market in plain language. We’ll run grounded Google-Search research and build a
        deck of competitive-intelligence cards — one per company, each backed by sources.
      </p>

      {!hasKey && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Demo mode</strong> — you’ll get sample data. Add a free Google AI Studio key in{' '}
            <Link to="/settings" className="underline">
              Settings
            </Link>{' '}
            for live research.
          </span>
        </div>
      )}

      {running ? (
        <div className="panel mt-6 p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary-ink" />
            <span className="font-medium text-content">Researching your market…</span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.round(Math.min(1, progress.pct) * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted">{progress.message}</p>
          <ResearchTerminal lines={log} />
          <p className="mt-3 text-xs text-muted">
            You’re watching the agent’s actual research steps — grounded Google searches, companies
            found, and cards assembled. This typically takes a few minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="panel mt-6 space-y-5 p-6">
          <div>
            <label className="label" htmlFor="prompt">
              Market
            </label>
            <textarea
              id="prompt"
              className="input min-h-24 text-base"
              placeholder="e.g. Direct-to-consumer Christian apparel brands"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              autoFocus
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  className="chip border-border text-muted hover:border-primary/50 hover:text-content"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="region">
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-4 w-4" /> Region <span className="text-muted">(optional)</span>
              </span>
            </label>
            <input
              id="region"
              className="input"
              placeholder="e.g. California, USA"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={!prompt.trim()}>
              <Sparkles className="h-4 w-4" />
              {hasKey ? 'Research & build deck' : 'Build sample deck'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
