import {
  changePasswordRequest,
  forgotPasswordRequest,
  loginRequest,
  resetPasswordRequest,
} from '../../modules/auth/adapters/in/http/auth.controller.js';
import * as c from './contract-schemas.js';
import type { ApiRoute } from './route-types.js';

const AUTH = '/api/admin/auth';
const CSRF = { 'X-Requested-With': 'cms-admin' };
const tag = 'Authentication';
const session = c.single(c.session);

export const AUTH_ROUTES: readonly ApiRoute[] = [
  {
    method: 'post',
    path: `${AUTH}/login`,
    rateLimited: true,
    id: 'login',
    summary: 'Log in',
    tag,
    auth: 'none',
    body: loginRequest,
    status: 200,
    response: session,
  },
  {
    method: 'post',
    path: `${AUTH}/refresh`,
    requiredHeaders: CSRF,
    id: 'refreshSession',
    summary: 'Exchange the refresh cookie for a new access token',
    tag,
    auth: 'refreshCookie',
    status: 200,
    response: session,
  },
  {
    method: 'post',
    path: `${AUTH}/logout`,
    requiredHeaders: CSRF,
    id: 'logout',
    summary: 'Log out',
    tag,
    auth: 'refreshCookie',
    status: 204,
  },
  {
    method: 'post',
    path: `${AUTH}/password/forgot`,
    rateLimited: true,
    id: 'forgotPassword',
    summary: 'Ask for a password reset email',
    tag,
    auth: 'none',
    body: forgotPasswordRequest,
    status: 204,
  },
  {
    method: 'post',
    path: `${AUTH}/password/reset`,
    rateLimited: true,
    id: 'resetPassword',
    summary: 'Set a new password with a reset token',
    tag,
    auth: 'none',
    body: resetPasswordRequest,
    status: 204,
  },
  {
    method: 'post',
    path: `${AUTH}/invitations/accept`,
    rateLimited: true,
    id: 'acceptInvitation',
    summary: 'Accept an invitation and set a password',
    tag,
    auth: 'none',
    body: resetPasswordRequest,
    status: 204,
  },
  {
    method: 'get',
    path: `${AUTH}/me`,
    id: 'getCurrentUser',
    summary: 'Get the signed-in user',
    tag,
    auth: 'bearer',
    status: 200,
    response: c.single(c.currentUser),
  },
  {
    method: 'post',
    path: `${AUTH}/password/change`,
    rateLimited: true,
    id: 'changePassword',
    summary: 'Change your own password',
    tag,
    auth: 'bearer',
    body: changePasswordRequest,
    status: 204,
  },
];
