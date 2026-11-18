import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createAppModule } from '../../../src/composition/app.module.js';
import {
  createInfrastructure,
  type RunningInfrastructure,
} from '../../../src/composition/infrastructure.js';
import { loadEnv } from '../../../src/config/env.schema.js';
import { configureApp } from '../../../src/shared/adapters/http/configure-app.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
const ADMIN_EMAIL = 'admin@example.com';
const PASSWORD = 'correct-horse-1';

// Runs the real app as a login in the cms_app role, as deployed environments will (FR-AUDIT-03).
describe('the app connected with only cms_app privileges', () => {
  let db: TestDatabase;
  let running: RunningInfrastructure;
  let app: INestApplication;
  let appUrl: string;

  const client = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const asApp = async (sql: string) => {
    const connection = new pg.Client({ connectionString: appUrl });
    await connection.connect();
    try {
      return await connection.query(sql);
    } finally {
      await connection.end();
    }
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    const parsed = new URL(db.url);
    parsed.username = 'cms_app_login';
    parsed.password = 'test-only';
    appUrl = parsed.toString();
    running = createInfrastructure(
      loadEnv({
        NODE_ENV: 'staging',
        PUBLIC_URL: 'https://cms.example.com',
        CORS_ALLOWED_ORIGINS: 'https://cms.example.com',
        DATABASE_URL: appUrl,
        REDIS_URL: `${inject('redisUrl')}/4`,
        JWT_SECRET: 'a'.repeat(64),
        ARGON2_MEMORY_KB: '1024',
        ARGON2_ITERATIONS: '1',
        EMAIL_PROVIDER: 'console',
        LOG_LEVEL: 'error',
      }),
    );
    const moduleRef = await Test.createTestingModule({
      imports: [createAppModule(running.infrastructure)],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, running.infrastructure);
    await app.init();
    await db.seedUser(ADMIN_ID, {
      email: ADMIN_EMAIL,
      role: 'admin',
      passwordHash: await running.infrastructure.hasher.hash(PASSWORD),
    });
  });

  afterAll(async () => {
    await app.close();
    await running.dispose();
    await db.close();
  });

  it('can log in, invite a user, and read the audit log', async () => {
    const session = await client()
      .post('/api/admin/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    const token = (session.body as { data: { access_token: string } }).data.access_token;

    await client()
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new@example.com', role: 'editor' })
      .expect(201);

    const audit = await client()
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const { data } = audit.body as { data: { action: string }[] };
    expect(data.map((event) => event.action)).toContain('user.create');
  });

  it.each([
    ['update', `UPDATE audit_events SET action = 'y'`],
    ['delete', 'DELETE FROM audit_events'],
    ['truncate', 'TRUNCATE audit_events'],
  ])('cannot %s the audit log', async (_name, sql) => {
    await expect(asApp(sql)).rejects.toThrow(/permission denied/);
  });

  it('gets access to tables that later migrations create', async () => {
    await db.context.client.$executeRawUnsafe('CREATE TABLE later_table (id int)');

    await expect(asApp('INSERT INTO later_table VALUES (1)')).resolves.toBeDefined();
  });
});
