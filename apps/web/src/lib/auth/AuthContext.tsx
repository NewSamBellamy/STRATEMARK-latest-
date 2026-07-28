/**
 * Auth boundary. v1 ships with NO auth (per decision), but everything routes
 * through this provider + `useAuth()` + `<RequireAuth>` so dropping in Firebase
 * Auth later is a provider swap with zero changes to feature code.
 * See firebase-auth-provider.stub.tsx for the drop-in target.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const LOCAL_USER: AuthUser = { id: 'local', name: 'Local Analyst', email: null };

/** v1 no-auth provider: a single local user, always authenticated. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthState>(
    () => ({
      user: LOCAL_USER,
      isAuthenticated: true,
      isLoading: false,
      signIn: async () => {},
      signOut: async () => {},
    }),
    [],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
