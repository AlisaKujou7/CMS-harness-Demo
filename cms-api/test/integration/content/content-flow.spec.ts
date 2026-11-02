import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createAppModule } from '../../../src/composition/app.module.js';
import {
  createInfrastructure,
  type RunningInfrastructure,
} from '../../../src/composition/infrastructure.js';
import { createMaintenanceJobs } from '../../../src/composition/maintenance-jobs.js';
import { loadEnv } from '../../../src/config/env.schema.js';
import { PublishContent } from '../../../src/modules/content/application/use-cases/lifecycle.use-case.js';
import { configureApp } from '../../../src/shared/adapters/http/configure-app.js';
import { aTextBody } from '../../builders/a-content.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const EDITOR_ID = '10000000-0000-4000-8000-000000000001';
const AUTHOR_ID = '10000000-0000-4000-8000-000000000002';
const PASSWORD = 'correct-horse-1';
const CONTENT = '/api/admin/content';

interface Created {
  data: { id: string; status: string; version: number; title: string; body: unknown };
}

// E2E-02 and E2E-03 at the API level, with production wiring against real Postgres and Redis.
describe('content lifecycle against real infrastructure', () => {
  let db: TestDatabase;
  let running: RunningInfrastructure;
  let app: INestApplication;

  const client = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const tokenOf = async (email: string) => {
    const res = await client()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', email)
      .send({ email, password: PASSWORD })
      .expect(200);
    return `Bearer ${(res.body as { data: { access_token: string } }).data.access_token}`;
  };
  const job = (name: string) => {
    const found = createMaintenanceJobs(running.infrastructure, 30_000).find(
      (candidate) => candidate.name === name,
    );
    if (!found) throw new Error(`No job ${name}`);
    return found;
  };
  const create = async (authorization: string, fields: object = {}) => {
    const res = await client()
      .post(CONTENT)
      .set('Authorization', authorization)
      .send({ type: 'article', title: 'A Story', body: aTextBody('Words'), ...fields })
      .expect(201);
    return (res.body as Created).data;
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    running = createInfrastructure(
      loadEnv({
        NODE_ENV: 'staging',
        PUBLIC_URL: 'https://cms.example.com',
        CORS_ALLOWED_ORIGINS: 'https://cms.example.com',
        DATABASE_URL: db.url,
        REDIS_URL: `${inject('redisUrl')}/5`,
        JWT_SECRET: 'a'.repeat(64),
        ARGON2_MEMORY_KB: '1024',
        ARGON2_ITERATIONS: '1',
        EMAIL_PROVIDER: 'console',
        LOG_LEVEL: 'error',
        RATE_LIMIT_LOGIN_PER_MIN: '1000',
        CONTENT_CATEGORIES: 'news, guides',
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
    const passwordHash = await running.infrastructure.hasher.hash(PASSWORD);
    await db.seedUser(EDITOR_ID, { email: 'editor@example.com', role: 'editor', passwordHash });
    await db.seedUser(AUTHOR_ID, { email: 'author@example.com', role: 'author', passwordHash });
  });

  it('takes an article from an Author through review to published, with history', async () => {
    const author = await tokenOf('author@example.com');
    const editor = await tokenOf('editor@example.com');
    const { id } = await create(author, { category: 'guides' });

    await client().post(`${CONTENT}/${id}/submit`).set('Authorization', author).expect(200);
    await client().post(`${CONTENT}/${id}/publish`).set('Authorization', author).expect(403);
    const published = await client()
      .post(`${CONTENT}/${id}/publish`)
      .set('Authorization', editor)
      .expect(200);

    expect((published.body as Created).data).toMatchObject({ status: 'published', version: 3 });
    const versions = await client()
      .get(`${CONTENT}/${id}/versions`)
      .set('Authorization', editor)
      .expect(200);
    expect(versions.body).toMatchObject({ pagination: { total: 3 } });
    const actions = await db.context.client.auditEvent.findMany({
      where: { targetId: id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(actions.map((event) => event.action).sort()).toEqual([
      'content.create',
      'content.publish',
      'content.submit',
    ]);
  });

  it('publishes on schedule from the job, attributed to no user (FR-CONTENT-07)', async () => {
    const editor = await tokenOf('editor@example.com');
    const { id } = await create(editor);
    const soon = new Date(Date.now() + 60_000).toISOString();
    await client()
      .post(`${CONTENT}/${id}/schedule`)
      .set('Authorization', editor)
      .send({ scheduled_at: soon })
      .expect(200);

    await expect(job('publish-due-content').run()).resolves.toBe(0);

    await db.context.client.content.update({
      where: { id },
      data: { scheduledAt: new Date(Date.now() - 1000) },
    });
    await expect(job('publish-due-content').run()).resolves.toBe(1);

    const row = await db.context.client.content.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: 'published', scheduledAt: null });
    const event = await db.context.client.auditEvent.findFirstOrThrow({
      where: { targetId: id, action: 'content.publish' },
    });
    expect(event.actorId).toBeNull();
  });

  it('purges a soft-deleted item once 30 days have passed (FR-CONTENT-13)', async () => {
    const editor = await tokenOf('editor@example.com');
    const { id } = await create(editor);
    await client().delete(`${CONTENT}/${id}`).set('Authorization', editor).expect(204);

    await expect(job('purge-deleted-content').run()).resolves.toBe(0);

    await db.context.client.content.update({
      where: { id },
      data: { deletedAt: new Date(Date.now() - 31 * 86_400_000) },
    });
    await expect(job('purge-deleted-content').run()).resolves.toBe(1);
    await expect(db.context.client.contentVersion.count()).resolves.toBe(0);
  });

  it('stores what PostgreSQL would otherwise refuse, without a server error', async () => {
    const editor = await tokenOf('editor@example.com');

    const content = await create(editor, {
      title: 'Nul\u0000 and lone \ud83d here',
      body: aTextBody('Body\u0000 with lone \ud83d'),
      seo_description: 'Seo\u0000',
      tags: ['t\u0000ag'],
    });

    expect(content.title).toBe('Nul and lone � here');
  });

  it('sees a body it stored as unchanged when the editor sends it again', async () => {
    const editor = await tokenOf('editor@example.com');
    const body = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Link', marks: [{ type: 'link', attrs: { href: '/a' } }] },
          ],
        },
      ],
    };
    const created = await create(editor, { body });

    const saved = await client()
      .patch(`${CONTENT}/${created.id}`)
      .set('Authorization', editor)
      .send({ version: created.version, body })
      .expect(200);

    expect((saved.body as Created).data.version).toBe(created.version);
  });

  it('gives simultaneous creates of one title their own slugs', async () => {
    const editor = await tokenOf('editor@example.com');

    const created = await Promise.all([1, 2, 3, 4].map(() => create(editor, { title: 'Same' })));

    expect(new Set(created.map((content) => content.id)).size).toBe(4);
  });

  it('lets a new item take the slug of a deleted one', async () => {
    const editor = await tokenOf('editor@example.com');
    const first = await create(editor, { slug: 'about' });
    await client().delete(`${CONTENT}/${first.id}`).set('Authorization', editor).expect(204);

    await create(editor, { slug: 'about' });
    await client()
      .post(CONTENT)
      .set('Authorization', editor)
      .send({ type: 'article', title: 'Other', slug: 'about' })
      .expect(409);
  });

  it('rolls everything back when the audit write fails', async () => {
    const editor = await tokenOf('editor@example.com');
    const { id } = await create(editor);
    const publish = new PublishContent({
      ...running.infrastructure,
      audit: { record: () => Promise.reject(new Error('audit is down')) },
    });

    await expect(
      publish.execute({ actor: { id: EDITOR_ID, role: 'editor' }, id, ip: null }),
    ).rejects.toThrow('audit is down');

    const row = await db.context.client.content.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('draft');
    await expect(
      db.context.client.contentVersion.count({ where: { contentId: id } }),
    ).resolves.toBe(1);
  });
});
