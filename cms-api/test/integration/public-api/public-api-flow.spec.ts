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
import { createMaintenanceJobs } from '../../../src/composition/maintenance-jobs.js';
import { loadEnv } from '../../../src/config/env.schema.js';
import { RedisResponseCache } from '../../../src/modules/public-api/adapters/out/redis-response-cache.js';
import { configureApp } from '../../../src/shared/adapters/http/configure-app.js';
import { aTextBody } from '../../builders/a-content.js';
import { InMemoryLogger } from '../../fakes/system.fakes.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const ADMIN_ID = '10000000-0000-4000-8000-000000000001';
const PASSWORD = 'correct-horse-1';
const CONTENT = '/api/admin/content';
const ARTICLES = '/api/v1/articles';

interface ListBody {
  data: { slug: string }[];
}

// E2E-02, E2E-04 and E2E-08 at the API level, with production wiring.
describe('public API against real infrastructure', () => {
  let db: TestDatabase;
  let running: RunningInfrastructure;
  let app: INestApplication;
  let admin: string;
  let apiKey: string;
  const redisUrl = () => `${inject('redisUrl')}/8`;

  const client = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const publicGet = (path: string) => client().get(path).set('X-API-Key', apiKey);
  const slugs = async () =>
    ((await publicGet(ARTICLES).expect(200)).body as ListBody).data.map((item) => item.slug);
  const createArticle = async (slug: string) => {
    const res = await client()
      .post(CONTENT)
      .set('Authorization', admin)
      .send({ type: 'article', title: slug, slug, body: aTextBody('Words') })
      .expect(201);
    return (res.body as { data: { id: string } }).data.id;
  };
  const action = (id: string, name: string) =>
    client().post(`${CONTENT}/${id}/${name}`).set('Authorization', admin);

  beforeAll(async () => {
    db = await createTestDatabase();
    running = createInfrastructure(
      loadEnv({
        NODE_ENV: 'staging',
        PUBLIC_URL: 'https://cms.example.com',
        CORS_ALLOWED_ORIGINS: 'https://cms.example.com',
        DATABASE_URL: db.url,
        REDIS_URL: redisUrl(),
        JWT_SECRET: 'a'.repeat(64),
        ARGON2_MEMORY_KB: '1024',
        ARGON2_ITERATIONS: '1',
        EMAIL_PROVIDER: 'console',
        LOG_LEVEL: 'error',
        RATE_LIMIT_LOGIN_PER_MIN: '1000',
        RATE_LIMIT_PUBLIC_API_PER_MIN: '1000',
      }),
    );
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
    await db.close();
  });

  beforeEach(async () => {
    await db.truncate();
    await running.infrastructure.responseCache.invalidateAll();
    await db.seedUser(ADMIN_ID, {
      email: 'admin@example.com',
      role: 'admin',
      passwordHash: await running.infrastructure.hasher.hash(PASSWORD),
    });
    const login = await client()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', 'public-flow')
      .send({ email: 'admin@example.com', password: PASSWORD })
      .expect(200);
    admin = `Bearer ${(login.body as { data: { access_token: string } }).data.access_token}`;
    const key = await client()
      .post('/api/admin/api-keys')
      .set('Authorization', admin)
      .send({ name: 'Flow' })
      .expect(201);
    apiKey = (key.body as { data: { key: string } }).data.key;
  });

  it('shows an article once published, and drops it at once when unpublished', async () => {
    const id = await createArticle('story');
    await expect(slugs()).resolves.toEqual([]);

    await action(id, 'publish').expect(200);
    await expect(slugs()).resolves.toEqual(['story']);

    await action(id, 'unpublish').expect(200);
    await expect(slugs()).resolves.toEqual([]);
    await publicGet(`${ARTICLES}/story`).expect(404);
  });

  it('changes the list ETag when an item is unpublished (FR-CONTENT-12)', async () => {
    const id = await createArticle('story');
    await action(id, 'publish').expect(200);
    const first = await publicGet(ARTICLES).expect(200);

    await action(id, 'unpublish').expect(200);

    const second = await publicGet(ARTICLES)
      .set('If-None-Match', first.headers['etag'] as string)
      .expect(200);
    expect(second.headers['etag']).not.toBe(first.headers['etag']);
  });

  it('answers a repeat from Redis, with the same body and a working 304', async () => {
    const id = await createArticle('story');
    await action(id, 'publish').expect(200);

    const first = await publicGet(`${ARTICLES}/story`).expect(200);
    await db.context.client.content.update({
      where: { id },
      data: { title: 'Changed underneath' },
    });
    const second = await publicGet(`${ARTICLES}/story`).expect(200);

    expect(second.body).toEqual(first.body);
    await publicGet(`${ARTICLES}/story`)
      .set('If-None-Match', first.headers['etag'] as string)
      .expect(304);
  });

  it('never serves a draft or a soft-deleted article, even with a real key', async () => {
    await createArticle('draft');
    const id = await createArticle('gone');
    await action(id, 'publish').expect(200);
    await client().delete(`${CONTENT}/${id}`).set('Authorization', admin).expect(204);

    await expect(slugs()).resolves.toEqual([]);
    await publicGet(`${ARTICLES}/draft`).expect(404);
    await publicGet(`${ARTICLES}/gone`).expect(404);
  });

  it('shows what the worker publishes on schedule at once', async () => {
    const id = await createArticle('later');
    await client()
      .post(`${CONTENT}/${id}/schedule`)
      .set('Authorization', admin)
      .send({ scheduled_at: new Date(Date.now() + 60_000).toISOString() })
      .expect(200);
    await expect(slugs()).resolves.toEqual([]);

    await db.context.client.content.update({
      where: { id },
      data: { scheduledAt: new Date(Date.now() - 1000) },
    });
    const job = createMaintenanceJobs(running.infrastructure, 30_000).find(
      (candidate) => candidate.name === 'publish-due-content',
    );
    await job?.run();

    await expect(slugs()).resolves.toEqual(['later']);
  });

  it('stops working when the key is revoked (E2E-08)', async () => {
    await publicGet(ARTICLES).expect(200);
    const list = await client().get('/api/admin/api-keys').set('Authorization', admin).expect(200);
    const { id } = (list.body as { data: { id: string }[] }).data[0] as { id: string };

    await client().delete(`/api/admin/api-keys/${id}`).set('Authorization', admin).expect(204);

    await publicGet(ARTICLES).expect(401);
  });

  describe('RedisResponseCache', () => {
    let redis: Redis;
    let cache: RedisResponseCache;

    beforeAll(() => {
      redis = new Redis(redisUrl(), { maxRetriesPerRequest: 1 });
      cache = new RedisResponseCache(redis, new InMemoryLogger());
    });

    afterAll(() => {
      redis.disconnect();
    });

    const read = async (key: string) => (await cache.lookup(key)).value;
    const write = async (key: string, value: string, ttl: number) => {
      await (await cache.lookup(key)).store(value, ttl);
    };

    it('stores, expires, and clears everything at once', async () => {
      await expect(read('none')).resolves.toBeNull();

      await write('a', 'value', 60);
      await write('short', 'value', 1);
      await expect(read('a')).resolves.toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 1200));
      await expect(read('short')).resolves.toBeNull();

      await cache.invalidateAll();
      await expect(read('a')).resolves.toBeNull();
    });

    it('does not let what was loaded before an invalidation survive it', async () => {
      const entry = await cache.lookup('race');

      await cache.invalidateAll();
      await entry.store('stale', 60);

      await expect(read('race')).resolves.toBeNull();
    });

    it('fails open when it cannot read, storing nothing', async () => {
      const failing = new InMemoryLogger();
      const broken = new RedisResponseCache(
        {
          get: () => Promise.reject(new Error('redis is down')),
          set: () => Promise.reject(new Error('should not be called')),
          incr: () => Promise.reject(new Error('redis is down')),
        },
        failing,
      );

      const entry = await broken.lookup('a');

      expect(entry.value).toBeNull();
      await expect(entry.store('b', 1)).resolves.toBeUndefined();
      await expect(broken.invalidateAll()).resolves.toBeUndefined();
      expect(failing.errors.map((item) => item.message)).toEqual([
        'Public cache read failed',
        'Public cache invalidation failed',
      ]);
    });

    it('fails open when only the write fails', async () => {
      const failing = new InMemoryLogger();
      const partial = new RedisResponseCache(
        {
          get: () => Promise.resolve(null),
          set: () => Promise.reject(new Error('redis is down')),
          incr: () => Promise.resolve(1),
        },
        failing,
      );

      await expect((await partial.lookup('a')).store('b', 1)).resolves.toBeUndefined();
      expect(failing.errors[0]?.message).toBe('Public cache write failed');
    });
  });
});
