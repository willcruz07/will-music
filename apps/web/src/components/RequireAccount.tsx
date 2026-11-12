import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { hasGoogleSession, useAccount } from '../lib/account.ts';

/** Public login is the only route outside this boundary, including stage/deep links. */
export const RequireAccount = ({ children }: { children: ReactNode }) => {
  const { user, ready } = useAccount();
  const location = useLocation();
  if (!ready) return <div className="flex min-h-dvh items-center justify-center px-5"><p role="status" className="animate-pulse text-sm text-muted-foreground">Restaurando sua sessão…</p></div>;
  if (!hasGoogleSession(user)) return <Navigate to={`/login?voltar=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />;
  return children;
};

export const accountReturn = (value: string | null): string => {
  try {
    const url = new URL(value || '/', window.location.origin);
    return url.origin === window.location.origin && url.pathname !== '/login' ? url.pathname + url.search + url.hash : '/';
  } catch { return '/'; }
};
