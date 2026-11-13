import { api, CSRF_HEADER, unwrap, unwrapData } from '../../../shared/api/client';
import type { AuthSession } from '../../../shared/api/types';

export function login(email: string, password: string): Promise<AuthSession> {
  return unwrapData(api.POST('/api/admin/auth/login', { body: { email, password } }));
}

export function requestPasswordReset(email: string): Promise<unknown> {
  return unwrap(api.POST('/api/admin/auth/password/forgot', { body: { email } }));
}

export function resetPassword(token: string, newPassword: string): Promise<unknown> {
  return unwrap(
    api.POST('/api/admin/auth/password/reset', { body: { token, new_password: newPassword } }),
  );
}

export function acceptInvitation(token: string, newPassword: string): Promise<unknown> {
  return unwrap(
    api.POST('/api/admin/auth/invitations/accept', {
      body: { token, new_password: newPassword },
    }),
  );
}

export function logout(): Promise<unknown> {
  return unwrap(api.POST('/api/admin/auth/logout', { params: { header: CSRF_HEADER } }));
}
