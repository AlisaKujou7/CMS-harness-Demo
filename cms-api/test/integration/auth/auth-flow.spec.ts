import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createAppModule } from '../../../src/composition/app.module.js';
import {
  createInfrastructure,
  type RunningInfrastructure,
} from '../../../src/composition/infrastructure.js';
import { loadEnv } from '../../../src/config/env.schema.js';
import { configureApp } from '../../../src/shared/adapters/http/configure-app.js';
import { CSRF_HEADER } from '../../builders/http-app.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
const ADMIN_EMAIL = 'admin@example.com';
const PASSWORD = 'correct-horse-1';
const NEW_PASSWORD = 'battery-staple-2';

const cookieOf = (setCookie: unknown): string => {
  const [first] = setCookie as string[];
  return (first ?? '').split(';')[0] ?? '';
};

// The whole stack with the production wiring: real Postgres, Redis, Argon2 and JWT.
describe('auth flow against real infrastructure', () => {
  let db: TestDatabase;
  let running: RunningInfrastructure;
  let app: INestApplication;
  let redis: Redis;

  const client = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const login = (password = PASSWORD) =>
    client().post('/api/admin/auth/login').send({ email: ADMIN_EMAIL, password });
  const auditActions = async () => {
    const rows = await db.context.client.auditEvent.findMany({ orderBy: { occurredAt: 'asc' } });
    return rows.map((row) => row.action);
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    redis = new Redis(inject('redisUrl'));
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
      RATE_LIMIT_LOGIN_PER_MIN: '10',
    });
    running = createInfrastructure(config);
    const moduleRef = await Test.createTestingModule({
      imports: [createAppModule(running.infrastructure)],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, running.infrastructure);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await running.dispose();
    await redis.quit();
    await db.close();
  });

  beforeEach(async () => {
    await db.truncate();
    await redis.flushall();
    await db.seedUser(ADMIN_ID, {
      email: ADMIN_EMAIL,
      role: 'admin',
      passwordHash: await running.infrastructure.hasher.hash(PASSWORD),
    });
  });

  it('logs in, calls a protected route, refreshes, and logs out', async () => {
    const session = await login().expect(200);
    const { access_token: token } = (session.body as { data: { access_token: string } }).data;
    const cookie = cookieOf(session.headers['set-cookie']);

    await client().get('/api/admin/api-keys').set('Authorization', `Bearer ${token}`).expect(200);

    const refreshed = await client()
      .post('/api/admin/auth/refresh')
      .set('Cookie', cookie)
      .set(CSRF_HEADER)
      .expect(200);
    const nextCookie = cookieOf(refreshed.headers['set-cookie']);
    expect(nextCookie).not.toBe(cookie);

    await client()
      .post('/api/admin/auth/logout')
      .set('Cookie', nextCookie)
      .set(CSRF_HEADER)
      .expect(204);
    await client()
      .post('/api/admin/auth/refresh')
      .set('Cookie', nextCookie)
      .set(CSRF_HEADER)
      .expect(401);

    await expect(auditActions()).resolves.toEqual([
      'auth.login.success',
      'auth.logout',
      'auth.session.reuse_detected',
    ]);
  });

  it('kills every session when a rotated refresh token is replayed, and the revocation commits', async () => {
    const session = await login().expect(200);
    const stolen = cookieOf(session.headers['set-cookie']);
    const refreshed = await client()
      .post('/api/admin/auth/refresh')
      .set('Cookie', stolen)
      .set(CSRF_HEADER)
      .expect(200);

    await client()
      .post('/api/admin/auth/refresh')
      .set('Cookie', stolen)
      .set(CSRF_HEADER)
      .expect(401);

    await client()
      .post('/api/admin/auth/refresh')
      .set('Cookie', cookieOf(refreshed.headers['set-cookie']))
      .set(CSRF_HEADER)
      .expect(401);
    await expect(auditActions()).resolves.toContain('auth.session.reuse_detected');
  });

  it('locks the account in the database after 5 failures (FR-AUTH-06)', async () => {
    for (let i = 0; i < 5; i += 1) await login('wrong-password-1').expect(401);

    await login().expect(401);

    const row = await db.context.client.loginLockout.findUnique({ where: { userId: ADMIN_ID } });
    expect(row?.failureCount).toBe(5);
    expect(row?.lockedUntil).not.toBeNull();
    await expect(auditActions()).resolves.toContain('auth.login.locked');
  });

  it('enforces the login rate limit through Redis (SEC-07)', async () => {
    for (let i = 0; i < 10; i += 1) await login('wrong-password-1');

    const res = await login();

    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('issues a working API key whose raw value is not stored', async () => {
    const session = await login().expect(200);
    const { access_token: token } = (session.body as { data: { access_token: string } }).data;

    const created = await client()
      .post('/api/admin/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Web' })
      .expect(201);

    const { key, id } = (created.body as { data: { key: string; id: string } }).data;
    expect(key).toMatch(/^cmsk_[\w-]{43}$/);
    const row = await db.context.client.apiKey.findUniqueOrThrow({ where: { id } });
    expect(row.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(key);
  });

  it('resets a password through the stored token hash', async () => {
    const hash = (token: string) => running.infrastructure.opaqueTokens.hash(token);
    await client().post('/api/admin/auth/password/forgot').send({ email: ADMIN_EMAIL }).expect(204);
    const [stored] = await db.context.client.passwordResetToken.findMany();
    expect(stored?.tokenHash).toHaveLength(hash('x').length);

    await db.context.client.passwordResetToken.update({
      where: { id: String(stored?.id) },
      data: { tokenHash: hash('known-token') },
    });
    await client()
      .post('/api/admin/auth/password/reset')
      .send({ token: 'known-token', new_password: NEW_PASSWORD })
      .expect(204);

    await login(NEW_PASSWORD).expect(200);
    await login(PASSWORD).expect(401);
  });

  it('reports ready when Postgres and Redis respond', async () => {
    await client().get('/readyz').expect(200);
  });
});
