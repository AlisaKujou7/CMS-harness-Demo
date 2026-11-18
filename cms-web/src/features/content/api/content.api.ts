import { api, unwrap, unwrapData } from '../../../shared/api/client';
import type {
  ContentCreateBody,
  ContentDetail,
  ContentListQuery,
  ContentListRow,
  ContentPatchBody,
  ContentVersionDetail,
  ContentVersionRow,
  Paged,
} from '../../../shared/api/types';

const onItem = (id: string) => ({ params: { path: { id } } });

export function listContent(query: ContentListQuery): Promise<Paged<ContentListRow>> {
  return unwrap(api.GET('/api/admin/content', { params: { query } }));
}

export function getContent(id: string): Promise<ContentDetail> {
  return unwrapData(api.GET('/api/admin/content/{id}', onItem(id)));
}

export function createContent(body: ContentCreateBody): Promise<ContentDetail> {
  return unwrapData(api.POST('/api/admin/content', { body }));
}

export function updateContent(id: string, body: ContentPatchBody): Promise<ContentDetail> {
  return unwrapData(api.PATCH('/api/admin/content/{id}', { ...onItem(id), body }));
}

export function deleteContent(id: string): Promise<unknown> {
  return unwrap(api.DELETE('/api/admin/content/{id}', onItem(id)));
}

export function restoreContent(id: string): Promise<ContentDetail> {
  return unwrapData(api.POST('/api/admin/content/{id}/restore', onItem(id)));
}

export function submitContent(id: string): Promise<ContentDetail> {
  return unwrapData(api.POST('/api/admin/content/{id}/submit', onItem(id)));
}

export function publishContent(id: string): Promise<ContentDetail> {
  return unwrapData(api.POST('/api/admin/content/{id}/publish', onItem(id)));
}

export function unpublishContent(id: string): Promise<ContentDetail> {
  return unwrapData(api.POST('/api/admin/content/{id}/unpublish', onItem(id)));
}

export function undoUnpublish(id: string): Promise<ContentDetail> {
  return unwrapData(api.POST('/api/admin/content/{id}/unpublish/undo', onItem(id)));
}

export function archiveContent(id: string): Promise<ContentDetail> {
  return unwrapData(api.POST('/api/admin/content/{id}/archive', onItem(id)));
}

export function rejectContent(id: string, note: string): Promise<ContentDetail> {
  return unwrapData(api.POST('/api/admin/content/{id}/reject', { ...onItem(id), body: { note } }));
}

export function scheduleContent(id: string, scheduledAt: string | null): Promise<ContentDetail> {
  return unwrapData(
    api.POST('/api/admin/content/{id}/schedule', {
      ...onItem(id),
      body: { scheduled_at: scheduledAt },
    }),
  );
}

export function listCategories(): Promise<readonly string[]> {
  return unwrapData(api.GET('/api/admin/content/categories'));
}

export function listVersions(id: string): Promise<Paged<ContentVersionRow>> {
  return unwrap(api.GET('/api/admin/content/{id}/versions', onItem(id)));
}

export function getVersion(id: string, version: number): Promise<ContentVersionDetail> {
  return unwrapData(
    api.GET('/api/admin/content/{id}/versions/{version}', {
      params: { path: { id, version } },
    }),
  );
}

export function revertContent(id: string, version: number): Promise<ContentDetail> {
  return unwrapData(
    api.POST('/api/admin/content/{id}/revert/{version}', {
      params: { path: { id, version } },
    }),
  );
}
