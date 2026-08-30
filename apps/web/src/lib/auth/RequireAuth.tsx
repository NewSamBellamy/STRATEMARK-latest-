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

/**
 * Build the app with the door removed: `VITE_OPEN_ACCESS=true pnpm build`.
 *
 * This exists for the public/judging build. The hackathon rules require judges
 * to test "free of charge and without restrictions", and a code they have to be
 * given is friction that pushes them toward scoring from the video instead of
 * the product.
 *
 * Removing the door is safe because the door was never what protected the
 * money. Spending is guarded independently, server-side: /v1/research refuses
 * any caller without a key or the app token, and the service caps its own daily
 * spend. So an open app costs nothing. See apps/api/src/lib/authz.ts.
 *
 * Read once at module scope — Vite replaces it at build time, so an open build
 * and a gated build are genuinely different artefacts rather than one artefact
 * with a runtime switch someone could flip in the console.
 */
const OPEN_ACCESS = import.meta.env.VITE_OPEN_ACCESS === 'true';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, signInWithGoogle, signInWithEmail } = useAuth();
  const [, force] = useState(0);
  useEffect(() => subscribeAccess(() => force((n) => n + 1)), []);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setEmailLoading(true);
    setEmailError('');
    
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      const e = err as Error;
      setEmailError(e.message || 'Login failed');
    } finally {
      setEmailLoading(false);
    }
  };

  if (OPEN_ACCESS) return <>{children}</>;
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
          
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-faint">
              <span className="bg-surface px-2">or</span>
            </div>
          </div>

          {!showEmailLogin ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="btn-ghost w-full justify-center border border-border"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Sign in with Google
              </button>
              <button
                type="button"
                onClick={() => setShowEmailLogin(true)}
                className="btn-ghost w-full justify-center border border-border"
              >
                Sign in with Email
              </button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="input w-full bg-body"
                  required
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="input w-full bg-body"
                  required
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailLogin(false)}
                  className="btn-ghost"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleEmailLogin}
                  disabled={emailLoading || !email || !password}
                  className="btn-primary flex-1"
                >
                  {emailLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
              
              {emailError && <p className="text-[12px] text-negative">{emailError}</p>}
            </div>
          )}
          
          {error && <p className="text-center text-[12px] text-negative">{error}</p>}
        </form>

        <p className="mx-auto mt-5 flex max-w-xs items-start justify-center gap-1.5 text-center text-[11px] leading-relaxed text-faint">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
          Your research and API key stay in this browser.
        </p>
      </div>
    </div>
  );
}
