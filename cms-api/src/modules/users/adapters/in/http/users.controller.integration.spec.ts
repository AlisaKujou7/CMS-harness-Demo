import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aUser as buildUser } from '../../../../../../test/builders/a-user.js';
import { anAccount } from '../../../../../../test/builders/auth-context.js';
import {
  createFakeInfrastructure,
  createTestApp,
  http,
  type FakeInfrastructure,
} from '../../../../../../test/builders/http-app.js';
import type { UserRole } from '../../../../../shared/kernel/actor.js';

const USERS = '/api/admin/users';
const TARGET = '22222222-2222-4222-8222-222222222222';
const MISSING = '33333333-3333-4333-8333-333333333333';

const aUser = (id: string, role: UserRole, status: 'active' | 'invited' = 'active') =>
  buildUser({ id, email: `${id}@example.com`, role, status });

describe('user endpoints', () => {
  let infra: FakeInfrastructure;
  let app: INestApplication;

  const bearer = async (role: UserRole) => {
    const id = `actor-${role}`;
    infra.accounts.add(anAccount({ id, email: `${id}@example.com`, role }));
    infra.users.add(aUser(id, role));
    return `Bearer ${await infra.signer.sign({ userId: id, role }, 900)}`;
  };

  beforeEach(async () => {
    infra = createFakeInfrastructure();
    infra.users.add(aUser(TARGET, 'editor'));
    app = await createTestApp(infra);
  });

  afterEach(() => app.close());

  describe('authorization matrix (FR-USER-01)', () => {
    type Call = readonly ['GET' | 'POST' | 'PATCH' | 'DELETE', string, object?];
    const calls: readonly Call[] = [
      ['GET', USERS],
      ['POST', USERS, { email: 'n@example.com', role: 'author' }],
      ['PATCH', `${USERS}/${TARGET}`, { role: 'author' }],
      ['POST', `${USERS}/${TARGET}/deactivate`],
      ['DELETE', `${USERS}/${TARGET}`],
      ['POST', `${USERS}/${TARGET}/reset-password`],
      ['POST', `${USERS}/${TARGET}/resend-invite`],
    ];
    const cases = calls.map((call) => [call[0], call[1], call] as const);
    const send = (call: Call) => {
      const [method, path, body] = call;
      const client = http(app);
      if (method === 'GET') return client.get(path);
      if (method === 'DELETE') return client.delete(path);
      return (method === 'POST' ? client.post(path) : client.patch(path)).send(body);
    };

    it.each(cases)('%s %s returns 401 without a token', async (_method, _path, call) => {
      await send(call).expect(401);
    });

    it.each(cases)('%s %s returns 403 for an editor', async (_method, _path, call) => {
      await send(call)
        .set('Authorization', await bearer('editor'))
        .expect(403);
    });

    it.each(cases)('%s %s returns 403 for an author', async (_method, _path, call) => {
      await send(call)
        .set('Authorization', await bearer('author'))
        .expect(403);
    });
  });

  describe('GET /api/admin/users', () => {
    it('lists users in the standard envelope', async () => {
      const res = await http(app)
        .get(`${USERS}?page=1&page_size=1`)
        .set('Authorization', await bearer('admin'))
        .expect(200);

      expect(res.body).toEqual({
        data: [
          {
            id: TARGET,
            email: `${TARGET}@example.com`,
            name: 'Someone',
            role: 'editor',
            status: 'active',
            last_login_at: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, page_size: 1, total: 2, total_pages: 2 },
      });
    });

    it('caps the page size at 100', async () => {
      const res = await http(app)
        .get(`${USERS}?page_size=500`)
        .set('Authorization', await bearer('admin'))
        .expect(200);

      expect((res.body as { pagination: { page_size: number } }).pagination.page_size).toBe(100);
    });

    it('returns 422 for a page that is not a positive number', async () => {
      const res = await http(app)
        .get(`${USERS}?page=abc`)
        .set('Authorization', await bearer('admin'))
        .expect(422);

      expect((res.body as { error: { details: unknown } }).error.details).toEqual({
        field: 'page',
      });
    });
  });

  describe('POST /api/admin/users', () => {
    it('invites the user and sends the email through the event', async () => {
      const res = await http(app)
        .post(USERS)
        .set('Authorization', await bearer('admin'))
        .send({ email: 'New@Example.com', role: 'author', name: 'New' })
        .expect(201);

      expect((res.body as { data: unknown }).data).toMatchObject({
        email: 'new@example.com',
        role: 'author',
        name: 'New',
        status: 'invited',
      });
      expect(infra.email.sent[0]?.to).toBe('new@example.com');
      expect(infra.email.sent[0]?.text).toContain('/accept-invitation?token=');
    });

    it.each([
      ['an unknown role', { email: 'a@example.com', role: 'root' }, 'role'],
      ['a missing role', { email: 'a@example.com' }, 'role'],
      ['an invalid email', { email: 'nope', role: 'author' }, 'email'],
      ['a blank name', { email: 'a@example.com', role: 'author', name: ' ' }, 'name'],
    ])('returns 422 for %s', async (_name, body, field) => {
      const res = await http(app)
        .post(USERS)
        .set('Authorization', await bearer('admin'))
        .send(body)
        .expect(422);

      expect((res.body as { error: { details: unknown } }).error.details).toEqual({ field });
    });

    it('returns 409 for a taken email', async () => {
      const res = await http(app)
        .post(USERS)
        .set('Authorization', await bearer('admin'))
        .send({ email: `${TARGET}@example.com`, role: 'author' })
        .expect(409);

      expect((res.body as { error: { code: string } }).error.code).toBe('EMAIL_TAKEN');
    });
  });

  describe('PATCH /api/admin/users/:id', () => {
    it('updates the role', async () => {
      const res = await http(app)
        .patch(`${USERS}/${TARGET}`)
        .set('Authorization', await bearer('admin'))
        .send({ role: 'author' })
        .expect(200);

      expect((res.body as { data: { role: string } }).data.role).toBe('author');
    });

    it('returns 409 when it would demote the last admin (FR-USER-04)', async () => {
      infra.users.add(aUser(TARGET, 'admin'));
      infra.accounts.add(anAccount({ id: 'caller', role: 'admin' }));
      const token = await infra.signer.sign({ userId: 'caller', role: 'admin' }, 900);

      const res = await http(app)
        .patch(`${USERS}/${TARGET}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'author' })
        .expect(409);

      expect((res.body as { error: { code: string } }).error.code).toBe('LAST_ADMIN');
    });

    it('returns 404 for a user who does not exist', async () => {
      await http(app)
        .patch(`${USERS}/${MISSING}`)
        .set('Authorization', await bearer('admin'))
        .send({ role: 'author' })
        .expect(404);
    });

    it('returns 422 for an id that is not a UUID', async () => {
      await http(app)
        .patch(`${USERS}/nope`)
        .set('Authorization', await bearer('admin'))
        .send({ role: 'author' })
        .expect(422);
    });
  });

  describe('POST /api/admin/users/:id/deactivate', () => {
    it('deactivates and revokes sessions through the event (FR-AUTH-05)', async () => {
      const revoked: string[] = [];
      const revokeAll = infra.refreshTokens.revokeAllForUser.bind(infra.refreshTokens);
      infra.refreshTokens.revokeAllForUser = async (userId, at) => {
        revoked.push(userId);
        await revokeAll(userId, at);
      };

      await http(app)
        .post(`${USERS}/${TARGET}/deactivate`)
        .set('Authorization', await bearer('admin'))
        .expect(204);

      expect(infra.users.users.get(TARGET)?.status).toBe('deactivated');
      expect(revoked).toEqual([TARGET]);
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('deletes', async () => {
      await http(app)
        .delete(`${USERS}/${TARGET}`)
        .set('Authorization', await bearer('admin'))
        .expect(204);

      expect(infra.users.users.has(TARGET)).toBe(false);
    });

    it('returns 409 while the user is referenced', async () => {
      infra.users.inUse.add(TARGET);

      const res = await http(app)
        .delete(`${USERS}/${TARGET}`)
        .set('Authorization', await bearer('admin'))
        .expect(409);

      expect((res.body as { error: { code: string } }).error.code).toBe('USER_IN_USE');
    });
  });

  describe('POST /api/admin/users/:id/reset-password', () => {
    it('emails the owner a reset link through the event (UR-A05)', async () => {
      infra.accounts.add(anAccount({ id: TARGET, email: `${TARGET}@example.com` }));

      await http(app)
        .post(`${USERS}/${TARGET}/reset-password`)
        .set('Authorization', await bearer('admin'))
        .expect(204);

      expect(infra.email.sent[0]?.to).toBe(`${TARGET}@example.com`);
      expect(infra.email.sent[0]?.text).toContain('/reset-password?token=');
    });
  });

  describe('POST /api/admin/users/:id/resend-invite', () => {
    it('sends another invitation', async () => {
      infra.users.add(aUser(TARGET, 'editor', 'invited'));

      await http(app)
        .post(`${USERS}/${TARGET}/resend-invite`)
        .set('Authorization', await bearer('admin'))
        .expect(204);

      expect(infra.email.sent[0]?.text).toContain('/accept-invitation?token=');
    });

    it('returns 409 for a user who already accepted', async () => {
      await http(app)
        .post(`${USERS}/${TARGET}/resend-invite`)
        .set('Authorization', await bearer('admin'))
        .expect(409);
    });
  });

  it('does not let a failing subscriber fail the request, and logs it', async () => {
    infra.email.send = () => {
      throw new Error('unexpected');
    };
    infra.invitationTokens.save = () => Promise.reject(new Error('db down'));

    await http(app)
      .post(USERS)
      .set('Authorization', await bearer('admin'))
      .send({ email: 'x@example.com', role: 'author' })
      .expect(201);

    expect(infra.logger.errors[0]).toMatchObject({
      message: 'Event subscriber failed',
      context: { event: 'UserInvited', error: 'db down' },
    });
  });
});
