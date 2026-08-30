import { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { getAccessProfile, subscribeAccess } from '@/lib/access';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { initials } from '@/lib/format';

function GoogleIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

/** Right-side controls — rendered inside AppShell's header. */
export function TopBar() {
  const { user, isAuthenticated, isLoading, error, signInWithGoogle, signOut, clearError } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Private-preview identity: whose access code opened this browser.
  const [access, setAccess] = useState(() => getAccessProfile());
  useEffect(() => subscribeAccess(() => setAccess(getAccessProfile())), []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />

      {error && (
        <div
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-negative/30 bg-negative/10 px-2.5 py-1 text-xs text-negative"
          onClick={clearError}
          title={error}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[150px] truncate">Auth Error</span>
        </div>
      )}

      {isAuthenticated && user ? (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-[13px] font-medium text-content transition-colors hover:bg-surface-2"
            aria-expanded={dropdownOpen}
            aria-label="User profile menu"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name}
                className="h-5 w-5 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-muted">
                {initials(user.name)}
              </div>
            )}
            <span className="hidden max-w-[140px] truncate sm:inline">{user.name}</span>
            <ChevronDown className="h-3 w-3 text-muted" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-surface p-3 shadow-card ring-1 ring-black/5">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.name}
                    className="h-10 w-10 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary-ink">
                    {initials(user.name)}
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="truncate text-sm font-semibold text-content">{user.name}</p>
                  <p className="truncate text-xs text-muted">
                    {user.email ?? 'No email provided'}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 rounded border border-positive/30 bg-positive/10 px-1.5 py-0.5 text-[10px] font-medium text-positive">
                    <GoogleIcon className="h-2.5 w-2.5" /> Google Account
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    setDropdownOpen(false);
                    await signOut();
                  }}
                  disabled={isLoading}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-negative transition-colors hover:bg-negative/10"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      ) : access ? (
        /* Preview build: no Google auth yet — show WHO unlocked this browser,
           so test-account sessions are visibly attributed. */
        <span
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted"
          title={`Signed in with ${access.name}'s access code${access.kind === 'test' ? ' (test account)' : ''} — Google sign-in arrives with launch.`}
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-muted">
            {initials(access.name)}
          </span>
          <span className="hidden max-w-[140px] truncate sm:inline">{access.name}</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[13px] font-medium text-primary-fg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="h-3 w-3 animate-pulse rounded-full bg-primary-fg/50" />
          ) : (
            <GoogleIcon className="h-3.5 w-3.5" />
          )}
          Sign in
        </button>
      )}
    </div>
  );
}
