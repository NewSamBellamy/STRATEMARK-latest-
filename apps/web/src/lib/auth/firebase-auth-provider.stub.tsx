/**
 * FirebaseAuthProvider (STUB / drop-in target — not wired in v1).
 *
 * When auth is turned on, install `firebase`, implement the TODOs below, and
 * swap <AuthProvider> for <FirebaseAuthProvider> in main.tsx. Because every
 * consumer uses the same `useAuth()` shape and `<RequireAuth>` guard, no feature
 * code changes — the guard starts enforcing automatically once
 * `isAuthenticated` can be false and `/login` renders a real sign-in screen.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { AuthState } from './AuthContext';

// NOTE: intentionally not exported from the barrel; this file documents the
// integration contract and is excluded from the v1 build path.

const StubContext = createContext<AuthState | null>(null);

export function FirebaseAuthProvider(_props: { children: ReactNode }): never {
  // TODO(auth): initializeApp(firebaseConfig); getAuth(); onAuthStateChanged(...)
  //   - map Firebase user → AuthUser
  //   - implement signIn (signInWithPopup / redirect) and signOut
  //   - expose isLoading while the initial auth state resolves
  //   - render <Navigate to="/login"> targets and a real /login screen
  throw new Error('FirebaseAuthProvider is a stub — implement before enabling auth.');
}

export function useFirebaseAuthStub(): AuthState {
  const ctx = useContext(StubContext);
  if (!ctx) throw new Error('stub');
  return ctx;
}
