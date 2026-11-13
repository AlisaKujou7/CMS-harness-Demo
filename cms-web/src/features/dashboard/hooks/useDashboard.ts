import { useQuery } from '@tanstack/react-query';
import { useUserDirectory } from '../../../shared/audit/useUserDirectory';
import type { SessionUser } from '../../../shared/stores/session.store';
import { type ActivityItem, fromAudit, fromContent } from '../activity';
import { getContentStats, listRecentContent, listRecentEvents } from '../api/dashboard.api';

export function useContentStats() {
  return useQuery({ queryKey: ['content', 'stats'], queryFn: getContentStats });
}

// Only an Admin may read the audit log, so everyone else sees what changed in their content.
export function useRecentActivity(role: SessionUser['role']) {
  const isAdmin = role === 'admin';
  const users = useUserDirectory(isAdmin);
  return useQuery<ActivityItem[]>({
    queryKey: ['dashboard', 'activity', role, users],
    queryFn: async () =>
      isAdmin
        ? fromAudit((await listRecentEvents()).data, users)
        : fromContent((await listRecentContent()).data),
  });
}
