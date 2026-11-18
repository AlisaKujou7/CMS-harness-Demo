import { api, unwrap, unwrapData } from '../../../shared/api/client';
import type { InviteBody, Paged, UserPatchBody, UserRow } from '../../../shared/api/types';

export function listUsers(page: number): Promise<Paged<UserRow>> {
  return unwrap(api.GET('/api/admin/users', { params: { query: { page } } }));
}

export function inviteUser(body: InviteBody): Promise<UserRow> {
  return unwrapData(api.POST('/api/admin/users', { body }));
}

export function updateUser(id: string, body: UserPatchBody): Promise<UserRow> {
  return unwrapData(api.PATCH('/api/admin/users/{id}', { params: { path: { id } }, body }));
}

const onUser = (id: string) => ({ params: { path: { id } } });

export function deactivateUser(id: string): Promise<unknown> {
  return unwrap(api.POST('/api/admin/users/{id}/deactivate', onUser(id)));
}

export function deleteUser(id: string): Promise<unknown> {
  return unwrap(api.DELETE('/api/admin/users/{id}', onUser(id)));
}

export function resetUserPassword(id: string): Promise<unknown> {
  return unwrap(api.POST('/api/admin/users/{id}/reset-password', onUser(id)));
}

export function resendInvite(id: string): Promise<unknown> {
  return unwrap(api.POST('/api/admin/users/{id}/resend-invite', onUser(id)));
}
