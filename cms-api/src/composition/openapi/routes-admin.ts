import { auditCriteriaQuery } from '../../modules/audit/adapters/in/http/audit.controller.js';
import { createApiKeyRequest } from '../../modules/auth/adapters/in/http/api-keys.controller.js';
import {
  inviteUserRequest,
  updateUserRequest,
} from '../../modules/users/adapters/in/http/users.controller.js';
import { pageQuery } from '../../shared/adapters/http/pagination.js';
import * as c from './contract-schemas.js';
import type { ApiRoute } from './route-types.js';

const KEYS = '/api/admin/api-keys';
const USERS = '/api/admin/users';
const AUDIT = '/api/admin/audit';
const auth = 'bearer';
const roles = 'Admin';
const keys = { tag: 'API keys', auth, roles } as const;
const users = { tag: 'Users', auth, roles } as const;
const audit = { tag: 'Audit log', auth, roles } as const;

export const ADMIN_ROUTES: readonly ApiRoute[] = [
  {
    ...keys,
    method: 'get',
    path: KEYS,
    id: 'listApiKeys',
    summary: 'List API keys',
    status: 200,
    response: c.allOf(c.apiKey),
  },
  {
    ...keys,
    method: 'post',
    path: KEYS,
    id: 'createApiKey',
    summary: 'Create an API key',
    body: createApiKeyRequest,
    status: 201,
    response: c.single(c.createdApiKey),
  },
  {
    ...keys,
    method: 'delete',
    path: `${KEYS}/{id}`,
    id: 'revokeApiKey',
    summary: 'Revoke an API key',
    status: 204,
  },
  {
    ...users,
    method: 'get',
    path: USERS,
    id: 'listUsers',
    summary: 'List users',
    query: pageQuery,
    status: 200,
    response: c.listOf(c.user),
  },
  {
    ...users,
    method: 'post',
    path: USERS,
    id: 'inviteUser',
    summary: 'Invite a user',
    body: inviteUserRequest,
    status: 201,
    response: c.single(c.user),
  },
  {
    ...users,
    method: 'patch',
    path: `${USERS}/{id}`,
    id: 'updateUser',
    summary: 'Update a user',
    body: updateUserRequest,
    status: 200,
    response: c.single(c.user),
  },
  {
    ...users,
    method: 'delete',
    path: `${USERS}/{id}`,
    id: 'deleteUser',
    summary: 'Delete a user no records refer to',
    status: 204,
  },
  {
    ...users,
    method: 'post',
    path: `${USERS}/{id}/deactivate`,
    id: 'deactivateUser',
    summary: 'Deactivate a user',
    status: 204,
  },
  {
    ...users,
    method: 'post',
    path: `${USERS}/{id}/reset-password`,
    id: 'sendUserPasswordReset',
    summary: 'Email a user a password reset link',
    status: 204,
  },
  {
    ...users,
    method: 'post',
    path: `${USERS}/{id}/resend-invite`,
    id: 'resendInvitation',
    summary: 'Send an invitation again',
    status: 204,
  },
  {
    ...audit,
    method: 'get',
    path: AUDIT,
    id: 'listAuditEvents',
    summary: 'List audit events',
    query: pageQuery.extend(auditCriteriaQuery.shape),
    status: 200,
    response: c.listOf(c.auditEvent),
  },
  {
    ...audit,
    method: 'get',
    path: `${AUDIT}/export.csv`,
    id: 'exportAuditEvents',
    summary: 'Export audit events as CSV',
    query: auditCriteriaQuery,
    status: 200,
    response: 'text/csv',
  },
];
