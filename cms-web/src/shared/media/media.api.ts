import { api, unwrap, unwrapData } from '../api/client';
import type {
  MediaDetail,
  MediaKind,
  MediaPatchBody,
  MediaRow,
  Paged,
  PresignedUpload,
} from '../api/types';

export interface MediaFilter {
  readonly page?: number;
  readonly page_size?: number;
  readonly search?: string;
  readonly kind?: MediaKind;
  readonly uploaded_by?: string;
  readonly from?: string;
}

export function listMedia(query: MediaFilter): Promise<Paged<MediaRow>> {
  return unwrap(api.GET('/api/admin/media', { params: { query } }));
}

export function getMedia(id: string): Promise<MediaDetail> {
  return unwrapData(api.GET('/api/admin/media/{id}', { params: { path: { id } } }));
}

export function updateMedia(id: string, body: MediaPatchBody): Promise<MediaRow> {
  return unwrapData(api.PATCH('/api/admin/media/{id}', { params: { path: { id } }, body }));
}

export function deleteMedia(id: string, force: boolean): Promise<unknown> {
  return unwrap(
    api.DELETE('/api/admin/media/{id}', {
      params: { path: { id }, query: force ? { force: 'true' } : {} },
    }),
  );
}

export function presignUpload(file: File): Promise<PresignedUpload> {
  return unwrapData(
    api.POST('/api/admin/media/presign', {
      body: { filename: file.name, mime_type: file.type, size_bytes: file.size },
    }),
  );
}

export function finalizeUpload(upload: PresignedUpload, file: File): Promise<MediaRow> {
  return unwrapData(
    api.POST('/api/admin/media', {
      body: { storage_key: upload.storage_key, filename: file.name, mime_type: file.type },
    }),
  );
}
