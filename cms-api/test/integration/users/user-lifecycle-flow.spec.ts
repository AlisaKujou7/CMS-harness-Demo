import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createAppModule } from '../../../src/composition/app.module.js';
import {
  createInfrastructure,
  type RunningInfrastructure,
} from '../../../src/composition/infrastructure.js';
import { loadEnv } from '../../../src/config/env.schema.js';
import { configureApp } from '../../../src/shared/adapters/http/configure-app.js';
import type { EmailMessage } from '../../../src/shared/ports/system.port.js';
import { CSRF_HEADER } from '../../builders/http-app.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
const ADMIN_EMAIL = 'admin@example.com';
const PASSWORD = 'correct-horse-1';
const USER_PASSWORD = 'battery-staple-2';

// E2E-01 and E2E-10 at the API level, with production wiring and a captured mailbox.
describe('user lifecycle against real infrastructure', () => {
  let db: TestDatabase;
  let running: RunningInfrastructure;
  let app: INestApplication;
  const mailbox: EmailMessage[] = [];

  const client = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const login = (email: string, password: string) =>
    client().post('/api/admin/auth/login').set('X-Forwarded-For', email).send({ email, password });
  const adminToken = async () => {
    const res = await login(ADMIN_EMAIL, PASSWORD).expect(200);
    return `Bearer ${(res.body as { data: { access_token: string } }).data.access_token}`;
  };
  const tokenFromMail = () => {
    const match = /token=([\w-]+)/.exec(mailbox.at(-1)?.text ?? '');
    return String(match?.[1]);
  };
  const inviteAndAccept = async (authorization: string) => {
    const invited = await client()
      .post('/api/admin/users')
      .set('Authorization', authorization)
      .send({ email: 'new@example.com', role: 'editor', name: 'New Person' })
      .expect(201);
    await client()
      .post('/api/admin/auth/invitations/accept')
      .send({ token: tokenFromMail(), new_password: USER_PASSWORD })
      .expect(204);
    return (invited.body as { data: { id: string } }).data.id;
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    const config = loadEnv({
      NODE_ENV: 'staging',
      PUBLIC_URL: 'https://cms.example.com',
      CORS_ALLOWED_ORIGINS: 'https://cms.example.com',
      DATABASE_URL: db.url,
      REDIS_URL: inject('redisUrl'),
      JWT_SECRET: 'a'.repeat(64),
      ARGON2_MEMORY_KB: '1024',
      ARGON2_ITERATIONS: '1',
      EMAIL_PROVIDER: 'console',
      LOG_LEVEL: 'error',
      RATE_LIMIT_LOGIN_PER_MIN: '1000',
      RATE_LIMIT_PASSWORD_RESET_PER_HOUR: '1000',
    });
    running = createInfrastructure(config);
    const infrastructure = {
      ...running.infrastructure,
      email: {
        send: (message: EmailMessage) => {
          mailbox.push(message);
          return Promise.resolve();
        },
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [createAppModule(infrastructure)],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, infrastructure);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await running.dispose();
    await db.close();
  });

  beforeEach(async () => {
    mailbox.length = 0;
    await db.context.client.apiKey.deleteMany();
    await db.context.client.user.deleteMany();
    await db.seedUser(ADMIN_ID, {
      email: ADMIN_EMAIL,
      role: 'admin',
      passwordHash: await running.infrastructure.hasher.hash(PASSWORD),
    });
  });

  it('invites a user, who accepts and logs in with the assigned role (E2E-01)', async () => {
    const authorization = await adminToken();

    const id = await inviteAndAccept(authorization);

    const session = await login('new@example.com', USER_PASSWORD).expect(200);
    expect((session.body as { data: { user: unknown } }).data.user).toEqual({
      id,
      email: 'new@example.com',
      name: 'New Person',
      role: 'editor',
    });
  });

  it('keeps an invited user out until the invitation is accepted', async () => {
    const authorization = await adminToken();
    await client()
      .post('/api/admin/users')
      .set('Authorization', authorization)
      .send({ email: 'new@example.com', role: 'editor' })
      .expect(201);

    await login('new@example.com', USER_PASSWORD).expect(401);
  });

  it('cuts off a deactivated user at once and blocks login (E2E-10)', async () => {
    const authorization = await adminToken();
    const id = await inviteAndAccept(authorization);
    const session = await login('new@example.com', USER_PASSWORD).expect(200);
    const access = (session.body as { data: { access_token: string } }).data.access_token;
    const cookie = String((session.headers['set-cookie'] as unknown as string[])[0]).split(';')[0];

    await client()
      .post(`/api/admin/users/${id}/deactivate`)
      .set('Authorization', authorization)
      .expect(204);

    await client().get('/api/admin/auth/me').set('Authorization', `Bearer ${access}`).expect(401);
    await client()
      .post('/api/admin/auth/refresh')
      .set('Cookie', String(cookie))
      .set(CSRF_HEADER)
      .expect(401);
    await login('new@example.com', USER_PASSWORD).expect(401);
    const open = await db.context.client.refreshToken.count({
      where: { userId: id, revokedAt: null },
    });
    expect(open).toBe(0);
  });

  it('applies a role change to the next request', async () => {
    const authorization = await adminToken();
    const id = await inviteAndAccept(authorization);
    const session = await login('new@example.com', USER_PASSWORD).expect(200);
    const access = (session.body as { data: { access_token: string } }).data.access_token;
    await client().get('/api/admin/users').set('Authorization', `Bearer ${access}`).expect(403);

    await client()
      .patch(`/api/admin/users/${id}`)
      .set('Authorization', authorization)
      .send({ role: 'admin' })
      .expect(200);

    await client().get('/api/admin/users').set('Authorization', `Bearer ${access}`).expect(200);
  });

  it('refuses to remove the only admin', async () => {
    const authorization = await adminToken();

    await client()
      .post(`/api/admin/users/${ADMIN_ID}/deactivate`)
      .set('Authorization', authorization)
      .expect(409);
    await client()
      .delete(`/api/admin/users/${ADMIN_ID}`)
      .set('Authorization', authorization)
      .expect(409);
  });

  it('lets an admin send a reset link, which works once (UR-A05)', async () => {
    const authorization = await adminToken();
    const id = await inviteAndAccept(authorization);

    await client()
      .post(`/api/admin/users/${id}/reset-password`)
      .set('Authorization', authorization)
      .expect(204);

    const token = tokenFromMail();
    await client()
      .post('/api/admin/auth/password/reset')
      .send({ token, new_password: 'after-reset-pass-3' })
      .expect(204);
    await login('new@example.com', 'after-reset-pass-3').expect(200);
  });

  it('records the lifecycle in the audit log with the acting admin and exports it', async () => {
    const authorization = await adminToken();
    const id = await inviteAndAccept(authorization);
    await client()
      .post(`/api/admin/users/${id}/deactivate`)
      .set('Authorization', authorization)
      .expect(204);

    const res = await client()
      .get(`/api/admin/audit?target_id=${id}&target_type=user`)
      .set('Authorization', authorization)
      .expect(200);

    const { data } = res.body as { data: { action: string; actor_id: string }[] };
    expect(data.map((event) => event.action).sort()).toEqual([
      'user.create',
      'user.deactivate',
      'user.invitation_accepted',
    ]);
    expect(data.find((event) => event.action === 'user.create')?.actor_id).toBe(ADMIN_ID);

    const csv = await client()
      .get(`/api/admin/audit/export.csv?target_id=${id}`)
      .set('Authorization', authorization)
      .expect(200);
    expect(csv.text.trim().split('\r\n')).toHaveLength(4);
  });
});
