import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';
import { FullPageLoader } from '@/components/states/FullPageLoader';
import { getAccessProfile, subscribeAccess, tryUnlock } from '@/lib/access';
import wordmark from '@/assets/wordmark.svg';

/**
 * The door, during private preview: a NAMED access code (founders + trackable
 * test accounts) is the lock while the app is publicly reachable. Google
 * sign-in takes over at launch — it runs on Firebase Auth and stays hidden
 * until the Firebase project config is baked into the build (an unconfigured
 * button that silently no-ops is worse than no button).
 *
 * Clean by request: wordmark, one input, one button. No decorative icons.
 * Tests bypass (they exercise the app, not the door).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const [, force] = useState(0);
  useEffect(() => subscribeAccess(() => force((n) => n + 1)), []);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (import.meta.env.MODE === 'test') return <>{children}</>;
  if (isLoading) return <FullPageLoader label="Checking your session…" />;
  if (isAuthenticated || getAccessProfile()) return <>{children}</>;

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const profile = await tryUnlock(code);
      if (!profile) {
        setError("That code didn't match. Codes are case-insensitive — check with Shannon or Toby.");
        return;
      }
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something broke checking the code — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <img src={wordmark} alt="" className="mx-auto h-12 w-12" />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-content">
            Stratemark
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Living market-intelligence decks — researched, sourced, self-verifying.
          </p>
        </div>

        <form onSubmit={(e) => void submit(e)} className="panel mt-6 space-y-3 p-5">
          <label
            htmlFor="access-code"
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted"
          >
            <Lock className="h-3.5 w-3.5" />
            Private preview — access code
          </label>
          <input
            id="access-code"
            className="input py-2.5 text-center font-display text-[15px] tracking-[0.15em]"
            placeholder="XXXX-XXXX-XX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-primary w-full justify-center" disabled={busy || !code.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {busy ? 'Checking…' : 'Enter'}
          </button>
          {error && <p className="text-center text-[12px] text-negative">{error}</p>}
        </form>

        <p className="mx-auto mt-5 flex max-w-xs items-start justify-center gap-1.5 text-center text-[11px] leading-relaxed text-faint">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
          Your research and API key stay in this browser. Google sign-in and subscriptions arrive
          with launch.
        </p>
      </div>
    </div>
  );
}
