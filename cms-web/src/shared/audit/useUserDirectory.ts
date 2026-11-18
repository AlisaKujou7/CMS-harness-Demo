import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../api/client';
import type { Paged, UserRow } from '../api/types';

const MAX_PAGE_SIZE = 100;

// Only Admins may list users, and only Admins see the audit log that needs their names.
export function useUserDirectory(enabled: boolean): readonly UserRow[] {
  const { data } = useQuery({
    queryKey: ['users', 'directory'],
    enabled,
    queryFn: () =>
      unwrap<Paged<UserRow>>(
        api.GET('/api/admin/users', { params: { query: { page_size: MAX_PAGE_SIZE } } }),
      ),
  });
  return data?.data ?? [];
}
