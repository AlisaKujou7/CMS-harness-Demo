import { api, unwrap, unwrapData } from '../../../shared/api/client';
import type { AuditRow, ContentListRow, ContentStats, Paged } from '../../../shared/api/types';

const RECENT = 10;

export function getContentStats(): Promise<ContentStats> {
  return unwrapData(api.GET('/api/admin/content/stats'));
}

export function listRecentEvents(): Promise<Paged<AuditRow>> {
  return unwrap(api.GET('/api/admin/audit', { params: { query: { page_size: RECENT } } }));
}

export function listRecentContent(): Promise<Paged<ContentListRow>> {
  return unwrap(
    api.GET('/api/admin/content', {
      params: { query: { page_size: RECENT, sort: '-updated_at' } },
    }),
  );
}
