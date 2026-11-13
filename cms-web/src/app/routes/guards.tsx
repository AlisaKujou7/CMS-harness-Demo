import { Navigate, Outlet, useLocation } from 'react-router';
import { TableSkeleton } from '../../design-system/components/Skeletons';
import type { UserRole } from '../../shared/api/types';
import { ForbiddenScreen } from '../../shared/components/PageErrors';
import { common } from '../../shared/i18n/common.messages';
import { useSessionStore } from '../../shared/stores/session.store';

export function RequireSession() {
  const status = useSessionStore((state) => state.status);
  const location = useLocation();
  if (status === 'loading') return <TableSkeleton label={common.loading} />;
  if (status === 'anonymous') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  return <Outlet />;
}

export function RequireAnonymous() {
  const status = useSessionStore((state) => state.status);
  if (status === 'loading') return <TableSkeleton label={common.loading} />;
  return status === 'authenticated' ? <Navigate to="/" replace /> : <Outlet />;
}

export function RequireRole({ allowed }: { readonly allowed: UserRole }) {
  const user = useSessionStore((state) => state.user);
  return user?.role === allowed ? <Outlet /> : <ForbiddenScreen />;
}
