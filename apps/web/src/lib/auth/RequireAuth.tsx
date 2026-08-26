import { useState, type ReactNode } from 'react';
import { KeyRound, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from './AuthContext';
import { FullPageLoader } from '@/components/states/FullPageLoader';
import { useApiKey } from '@/lib/settings/apiKey';
import wordmark from '@/assets/wordmark.svg';

/**
 * Route guard — Google first, then the key (founder's flow: "they should
 * authenticate with Google before adding their API key").
 *
 * Step 1 · Sign in with Google — identity for subscriptions and (Pro) sync.
 * Step 2 · handled in-app: connect a Gemini key in Settings, or explore the
 *          sample deck in demo mode first.
 *
 * Tests bypass the gate (they exercise the app, not the IdP).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, signInWithGoogle } = useAuth();
  const hasKey = useApiKey((s) => s.hasKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (import.meta.env.MODE === 'test') return <>{children}</>;
  if (isLoading) return <FullPageLoader label="Checking your session…" />;
  if (isAuthenticated || hasKey) return <>{children}</>;

  const signIn = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-6">
      <div className="w-full max-w-md text-center">
        <img src={wordmark} alt="" className="mx-auto h-14 w-14" />
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-content">
          Welcome to Stratemark
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Living market-intelligence decks — researched, sourced, and self-verifying. Sign in to
          get started; you'll connect your research engine right after.
        </p>

        {/* The two-step, made visible. */}
        <ol className="mx-auto mt-6 max-w-xs space-y-2 text-left">
          <li className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-bold text-white">
              1
            </span>
            <span className="text-[13px] font-medium text-content">Sign in with Google</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 opacity-70">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-[12px] font-bold text-muted">
              2
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
              <KeyRound className="h-3.5 w-3.5" />
              Connect your Gemini key (or explore the sample deck)
            </span>
          </li>
        </ol>

        <button type="button" className="btn-primary mt-6 w-full max-w-xs" disabled={busy} onClick={() => void signIn()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? 'Opening Google…' : 'Sign in with Google'}
        </button>
        {error && <p className="mt-3 text-[12px] text-negative">{error}</p>}

        <p className="mx-auto mt-5 flex max-w-xs items-start justify-center gap-1.5 text-[11px] leading-relaxed text-faint">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
          Your research and API key stay in this browser. Sign-in identifies your account for
          subscriptions and Pro cloud sync.
        </p>
      </div>
    </div>
  );
}
