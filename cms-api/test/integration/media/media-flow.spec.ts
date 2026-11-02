import { randomUUID } from 'node:crypto';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Worker } from 'bullmq';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { createAppModule } from '../../../src/composition/app.module.js';
import {
  createInfrastructure,
  type RunningInfrastructure,
  VARIANT_QUEUE,
} from '../../../src/composition/infrastructure.js';
import { mediaDeps } from '../../../src/composition/module-deps.js';
import { loadEnv } from '../../../src/config/env.schema.js';
import { startVariantWorker } from '../../../src/modules/media/adapters/in/queue/variant-worker.js';
import { GenerateMediaVariants } from '../../../src/modules/media/application/use-cases/media-background.use-case.js';
import { configureApp } from '../../../src/shared/adapters/http/configure-app.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const AUTHOR_ID = '10000000-0000-4000-8000-000000000001';
const ADMIN_ID = '10000000-0000-4000-8000-000000000002';
const PASSWORD = 'correct-horse-1';
const MEDIA = '/api/admin/media';
const CONTENT = '/api/admin/content';
const KEY = 'test-only-key';
const SECRET = 'test-only-secret';

interface MediaResponse {
  id: string;
  url: string;
  width: number | null;
  size_bytes: number;
  variant_status: string;
  variants: Record<string, { url: string; width: number; height: number }>;
}

// E2E-05 at the API level: real Postgres, Redis, MinIO, sharp and the variant worker.
describe('media against real infrastructure', () => {
  let db: TestDatabase;
  let running: RunningInfrastructure;
  let app: INestApplication;
  let worker: Worker;
  let png: Buffer;

  const client = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const tokenOf = async (email: string) => {
    const res = await client()
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', email)
      .send({ email, password: PASSWORD })
      .expect(200);
    return `Bearer ${(res.body as { data: { access_token: string } }).data.access_token}`;
  };
  const presign = async (
    authorization: string,
    file: { filename: string; mime: string; bytes: Uint8Array },
  ) => {
    const res = await client()
      .post(`${MEDIA}/presign`)
      .set('Authorization', authorization)
      .send({ filename: file.filename, mime_type: file.mime, size_bytes: file.bytes.length })
      .expect(200);
    return (res.body as { data: { upload_url: string; storage_key: string } }).data;
  };
  const uploadAndFinalize = async (
    authorization: string,
    file: { filename: string; mime: string; bytes: Uint8Array },
  ) => {
    const { upload_url: url, storage_key: key } = await presign(authorization, file);
    const put = await fetch(url, {
      method: 'PUT',
      body: new Uint8Array(file.bytes),
      headers: { 'Content-Type': file.mime },
    });
    expect(put.status).toBe(200);
    return client()
      .post(MEDIA)
      .set('Authorization', authorization)
      .send({ storage_key: key, filename: file.filename, mime_type: file.mime });
  };
  const getMedia = async (authorization: string, id: string) => {
    const res = await client()
      .get(`${MEDIA}/${id}`)
      .set('Authorization', authorization)
      .expect(200);
    return (res.body as { data: MediaResponse & { usage_count: number } }).data;
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    const endpoint = inject('minioUrl');
    const bucket = `flow-${randomUUID()}`;
    const admin = new S3Client({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
    });
    await admin.send(new CreateBucketCommand({ Bucket: bucket }));
    admin.destroy();

    const redisUrl = `${inject('redisUrl')}/6`;
    running = createInfrastructure(
      loadEnv({
        NODE_ENV: 'staging',
        PUBLIC_URL: 'https://cms.example.com',
        CORS_ALLOWED_ORIGINS: 'https://cms.example.com',
        DATABASE_URL: db.url,
        REDIS_URL: redisUrl,
        JWT_SECRET: 'a'.repeat(64),
        ARGON2_MEMORY_KB: '1024',
        ARGON2_ITERATIONS: '1',
        EMAIL_PROVIDER: 'console',
        LOG_LEVEL: 'error',
        RATE_LIMIT_LOGIN_PER_MIN: '1000',
        OBJECT_STORAGE_PROVIDER: 'minio',
        OBJECT_STORAGE_ENDPOINT: endpoint,
        OBJECT_STORAGE_BUCKET: bucket,
        OBJECT_STORAGE_ACCESS_KEY: KEY,
        OBJECT_STORAGE_SECRET_KEY: SECRET,
      }),
    );
    worker = startVariantWorker(
      redisUrl,
      VARIANT_QUEUE,
      new GenerateMediaVariants(mediaDeps(running.infrastructure)),
      running.infrastructure.logger,
    );
    const moduleRef = await Test.createTestingModule({
      imports: [createAppModule(running.infrastructure)],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, running.infrastructure);
    await app.init();

    png = await sharp({ create: { width: 1600, height: 800, channels: 3, background: '#369' } })
      .png()
      .toBuffer();
  });

  afterAll(async () => {
    await app.close();
    await worker.close();
    await running.dispose();
    await db.close();
  });

  beforeEach(async () => {
    await db.truncate();
    const passwordHash = await running.infrastructure.hasher.hash(PASSWORD);
    await db.seedUser(AUTHOR_ID, { email: 'author@example.com', role: 'author', passwordHash });
    await db.seedUser(ADMIN_ID, { email: 'admin@example.com', role: 'admin', passwordHash });
  });

  it('uploads straight to storage, and the worker makes the variants (FR-MEDIA-04, 05)', async () => {
    const author = await tokenOf('author@example.com');

    const finalized = await uploadAndFinalize(author, {
      filename: 'hero.png',
      mime: 'image/png',
      bytes: png,
    });
    expect(finalized.status).toBe(201);
    const { id, url, variant_status: status } = (finalized.body as { data: MediaResponse }).data;
    expect(status).toBe('pending');

    const original = await fetch(url);
    expect(Buffer.from(await original.arrayBuffer())).toEqual(png);

    let ready = await getMedia(author, id);
    await vi.waitFor(
      async () => {
        ready = await getMedia(author, id);
        expect(ready.variant_status).toBe('ready');
      },
      { timeout: 20_000, interval: 200 },
    );
    expect(ready.width).toBe(1600);
    expect(ready.variants['thumbnail']).toMatchObject({ width: 320, height: 160 });
    expect(ready.variants['medium']).toMatchObject({ width: 1024, height: 512 });
    const thumbnail = await fetch(ready.variants['thumbnail']?.url ?? '');
    expect(thumbnail.headers.get('content-type')).toBe('image/webp');

    const event = await db.context.client.auditEvent.findFirstOrThrow({
      where: { targetId: id, action: 'media.upload' },
    });
    expect(event.actorId).toBe(AUTHOR_ID);
  });

  it('refuses a file disguised as an image and removes it (FR-MEDIA-03)', async () => {
    const author = await tokenOf('author@example.com');
    const bytes = Buffer.from('<html><script>alert(1)</script></html>');

    const { upload_url: url, storage_key: key } = await presign(author, {
      filename: 'fake.png',
      mime: 'image/png',
      bytes,
    });
    await fetch(url, {
      method: 'PUT',
      body: new Uint8Array(bytes),
      headers: { 'Content-Type': 'image/png' },
    });
    const res = await client()
      .post(MEDIA)
      .set('Authorization', author)
      .send({ storage_key: key, filename: 'fake.png', mime_type: 'image/png' })
      .expect(422);

    expect((res.body as { error: { code: string } }).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    await expect(running.infrastructure.storage.head(key)).resolves.toBeNull();
    await expect(db.context.client.mediaItem.count()).resolves.toBe(0);
  });

  it('stores an SVG sanitized (SEC-05), and still makes its variants', async () => {
    const author = await tokenOf('author@example.com');
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><script>alert(1)</script><rect width="640" height="320" fill="#369" onload="alert(2)"/></svg>';

    const res = await uploadAndFinalize(author, {
      filename: 'logo.svg',
      mime: 'image/svg+xml',
      bytes: Buffer.from(dirty),
    });

    expect(res.status).toBe(201);
    const { id, url } = (res.body as { data: MediaResponse }).data;
    const stored = await (await fetch(url)).text();
    expect(stored).not.toMatch(/script|onload|alert/);
    expect(stored).toContain('<rect');
    await vi.waitFor(
      async () => {
        expect((await getMedia(author, id)).variant_status).toBe('ready');
      },
      { timeout: 20_000, interval: 200 },
    );
  });

  it('serves a PDF as a download, with no variants', async () => {
    const author = await tokenOf('author@example.com');

    const res = await uploadAndFinalize(author, {
      filename: 'faq.pdf',
      mime: 'application/pdf',
      bytes: Buffer.from('%PDF-1.7\n'),
    });

    const { url, variant_status: status } = (res.body as { data: MediaResponse }).data;
    expect(status).toBe('none');
    expect((await fetch(url)).headers.get('content-disposition')).toContain('attachment');
  });

  it('cannot be swapped by a second upload once finalized', async () => {
    const author = await tokenOf('author@example.com');
    const file = { filename: 'hero.png', mime: 'image/png', bytes: png };
    const { upload_url: url, storage_key: key } = await presign(author, file);
    await fetch(url, {
      method: 'PUT',
      body: new Uint8Array(png),
      headers: { 'Content-Type': 'image/png' },
    });
    const res = await client()
      .post(MEDIA)
      .set('Authorization', author)
      .send({ storage_key: key, filename: 'hero.png', mime_type: 'image/png' })
      .expect(201);

    const evil = Buffer.alloc(png.length, 0x41);
    await fetch(url, {
      method: 'PUT',
      body: new Uint8Array(evil),
      headers: { 'Content-Type': 'image/png' },
    });

    const media = (res.body as { data: MediaResponse }).data;
    expect(Buffer.from(await (await fetch(media.url)).arrayBuffer())).toEqual(png);
    await client()
      .post(MEDIA)
      .set('Authorization', author)
      .send({ storage_key: key, filename: 'hero.png', mime_type: 'image/png' })
      .expect(422);
  });

  it('refuses to finalize an upload that never happened', async () => {
    const author = await tokenOf('author@example.com');
    const { storage_key: key } = await presign(author, {
      filename: 'a.png',
      mime: 'image/png',
      bytes: png,
    });

    await client()
      .post(MEDIA)
      .set('Authorization', author)
      .send({ storage_key: key, filename: 'a.png', mime_type: 'image/png' })
      .expect(404);
  });

  it('ties content to media: refuses to delete what is used, until forced (FR-MEDIA-07)', async () => {
    const author = await tokenOf('author@example.com');
    const admin = await tokenOf('admin@example.com');
    const uploaded = await uploadAndFinalize(author, {
      filename: 'hero.png',
      mime: 'image/png',
      bytes: png,
    });
    const { id, url } = (uploaded.body as { data: MediaResponse }).data;

    const article = await client()
      .post(CONTENT)
      .set('Authorization', author)
      .send({
        type: 'article',
        title: 'Story',
        featured_image_id: id,
        body: {
          type: 'doc',
          content: [{ type: 'image', attrs: { src: '/placeholder.png', mediaId: id } }],
        },
      })
      .expect(201);
    const articleId = (article.body as { data: { id: string } }).data.id;

    expect((await getMedia(author, id)).usage_count).toBe(1);
    const refused = await client().delete(`${MEDIA}/${id}`).set('Authorization', admin).expect(409);
    expect((refused.body as { error: { code: string } }).error.code).toBe('MEDIA_IN_USE');

    await client().delete(`${MEDIA}/${id}?force=true`).set('Authorization', author).expect(403);
    await client().delete(`${MEDIA}/${id}?force=true`).set('Authorization', admin).expect(204);

    expect((await fetch(url)).status).toBe(404);
    const row = await db.context.client.content.findUniqueOrThrow({ where: { id: articleId } });
    expect(row.featuredImageId).toBeNull();
  });

  it('refuses content that points at media that does not exist', async () => {
    const author = await tokenOf('author@example.com');

    const res = await client()
      .post(CONTENT)
      .set('Authorization', author)
      .send({ type: 'article', title: 'T', featured_image_id: randomUUID() })
      .expect(422);

    expect((res.body as { error: { code: string } }).error.code).toBe('MEDIA_NOT_FOUND');
  });
});
