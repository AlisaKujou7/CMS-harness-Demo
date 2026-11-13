import { api, unwrap, unwrapData } from '../../../shared/api/client';
import type { ApiKeyRow, NewApiKey } from '../../../shared/api/types';

export function listApiKeys(): Promise<readonly ApiKeyRow[]> {
  return unwrapData(api.GET('/api/admin/api-keys'));
}

export function createApiKey(name: string): Promise<NewApiKey> {
  return unwrapData(api.POST('/api/admin/api-keys', { body: { name } }));
}

export function revokeApiKey(id: string): Promise<unknown> {
  return unwrap(api.DELETE('/api/admin/api-keys/{id}', { params: { path: { id } } }));
}
