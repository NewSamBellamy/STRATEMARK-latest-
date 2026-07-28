import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { FullPageLoader } from '@/components/states/FullPageLoader';

/**
 * Route guard. A no-op under v1's no-auth provider (always authenticated), but
 * present in the routing tree so enabling Firebase later needs no route changes.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader label="Checking your session…" />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
