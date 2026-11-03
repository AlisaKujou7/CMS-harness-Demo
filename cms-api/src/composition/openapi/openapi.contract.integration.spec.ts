import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { aContent, aTextBody, T0 } from '../../../test/builders/a-content.js';
import { aMediaItem, MEDIA_ID, PNG_BYTES } from '../../../test/builders/a-media-item.js';
import { anAccount, anApiKey } from '../../../test/builders/auth-context.js';
import {
  createFakeInfrastructure,
  createTestApp,
  CSRF_HEADER,
  type FakeInfrastructure,
} from '../../../test/builders/http-app.js';
import { aUser } from '../../../test/builders/a-user.js';
import { mountApiDocs } from '../../shared/adapters/http/api-docs.js';
import { buildOpenApiDocument } from './build-document.js';
import { errorEnvelope } from './contract-schemas.js';
import { API_ROUTES, type ApiRoute } from './routes.js';

const ADMIN = '55555555-1111-4111-8111-111111111111';
const PAGE = '55555555-2222-4222-8222-222222222222';
const KEY = '55555555-3333-4333-8333-333333333333';
const VERSION = '55555555-4444-4444-8444-444444444444';
const ID = '22222222-2222-4222-8222-222222222222';
const API_KEY = 'cmsk_contract';
const client = (app: INestApplication) =>
  request(app.getHttpServer() as Parameters<typeof request>[0]);

interface Scenario {
  readonly path?: string;
  readonly body?: object;
  readonly headers?: Readonly<Record<string, string>>;
}

describe('the published specification (M-API-04)', () => {
  let infra: FakeInfrastructure;
  let app: INestApplication;
  let bearer: string;
  const document = buildOpenApiDocument();

  const seed = async () => {
    infra.accounts.add(anAccount({ id: ADMIN, role: 'admin' }));
    infra.users.add(aUser({ id: ID, email: 'other@example.com', role: 'editor' }));
    await infra.apiKeys.save(
      anApiKey({ id: KEY, keyHash: infra.opaqueTokens.hash(API_KEY), createdBy: ADMIN }),
    );
    const variants = { thumbnail: { key: 'thumb', width: 320, height: 160 } };
    infra.media.add(aMediaItem({ uploadedBy: ADMIN, variants, variantStatus: 'ready' }));
    const live = {
      status: 'published' as const,
      publishedAt: T0,
      body: aTextBody('Text'),
      authorId: ADMIN,
    };
    infra.contents.add(aContent({ ...live, id: ID, slug: 'story', featuredImageId: MEDIA_ID }));
    infra.contents.add(aContent({ ...live, id: PAGE, type: 'page', slug: 'about' }));
    await infra.contents.addVersion(
      {
        id: VERSION,
        contentId: ID,
        versionNo: 1,
        editorId: ADMIN,
        createdAt: T0,
        snapshot: {
          title: 'T',
          slug: 'story',
          body: aTextBody('Text'),
          status: 'draft',
          featuredImageId: null,
          socialImageId: null,
          seoTitle: null,
          seoDescription: null,
          tags: [],
          category: null,
          parentId: null,
        },
      },
      50,
    );
    await infra.audit.record({
      actorId: ADMIN,
      actorIp: null,
      action: 'x',
      targetType: null,
      targetId: null,
      summary: {},
    });
  };

  beforeAll(async () => {
    infra = createFakeInfrastructure();
    await seed();
    app = await createTestApp(infra, [], (created) => {
      mountApiDocs(created, document);
    });
    bearer = `Bearer ${await infra.signer.sign({ userId: ADMIN, role: 'admin' }, 900)}`;
  });

  afterAll(() => app.close());

  it('matches the committed copy, so a change must be reviewed (06-TEST-STRATEGY 9.1)', () => {
    const committed = readFileSync(
      join(import.meta.dirname, '..', '..', '..', 'openapi.json'),
      'utf8',
    );

    expect(JSON.parse(committed)).toEqual(JSON.parse(JSON.stringify(document)));
  });

  it('lists exactly the routes the application serves', () => {
    const server = app.getHttpAdapter().getInstance() as Express;
    const stack = (server as unknown as { router: { stack: { route?: RouteLayer }[] } }).router
      .stack;
    interface RouteLayer {
      path: string;
      methods: Record<string, boolean>;
    }
    const docs = [
      '/openapi.json',
      '/docs',
      '/docs/init.js',
      '/docs/swagger-ui.css',
      '/docs/swagger-ui-bundle.js',
    ];
    const served = stack
      .flatMap((layer) => (layer.route ? [layer.route] : []))
      .filter((route) => !docs.includes(route.path))
      .flatMap((route) =>
        Object.keys(route.methods).map(
          (method) => `${method} ${route.path.replace(/:(\w+)/g, '{$1}')}`,
        ),
      );
    const documented = API_ROUTES.map((route) => `${route.method} ${route.path}`);

    expect([...served].sort()).toEqual([...documented].sort());
  });

  it('has an operation for every route, each with a unique id', () => {
    const ids = API_ROUTES.map((route) => route.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(API_ROUTES.length).toBeGreaterThanOrEqual(49);
  });

  describe('responses match it', () => {
    // Routes with no body have nothing to match, and the route list above already covers them.
    const scenarios: Readonly<Record<string, Scenario>> = {
      login: { body: { email: 'alice@example.com', password: 'correct-horse-1' } },
      getCurrentUser: {},
      listApiKeys: {},
      createApiKey: { body: { name: 'New' } },
      listUsers: {},
      inviteUser: { body: { email: 'new@example.com', role: 'author' } },
      updateUser: { path: `/api/admin/users/${ID}`, body: { name: 'Renamed' } },
      listAuditEvents: {},
      listContent: {},
      getContentStats: {},
      listContentCategories: {},
      createContent: { body: { type: 'article', title: 'Created' } },
      getContent: { path: `/api/admin/content/${ID}` },
      listContentVersions: { path: `/api/admin/content/${ID}/versions` },
      getContentVersion: { path: `/api/admin/content/${ID}/versions/1` },
      presignUpload: { body: { filename: 'a.png', mime_type: 'image/png', size_bytes: 10 } },
      listMedia: {},
      getMedia: { path: `/api/admin/media/${MEDIA_ID}` },
      updateMedia: { path: `/api/admin/media/${MEDIA_ID}`, body: { alt_text: 'Alt' } },
      listArticles: {},
      getArticle: { path: '/api/v1/articles/story' },
      listPages: {},
      getPage: { path: '/api/v1/pages/about' },
      getPublicMedia: { path: `/api/v1/media/${MEDIA_ID}` },
      getLiveness: {},
      getReadiness: {},
    };
    const route = (id: string) => API_ROUTES.find((candidate) => candidate.id === id) as ApiRoute;

    const call = (target: ApiRoute, scenario: Scenario) => {
      const test = client(app)[target.method](scenario.path ?? target.path);
      if (target.auth === 'bearer') void test.set('Authorization', bearer);
      if (target.auth === 'apiKey') void test.set('X-API-Key', API_KEY);
      void test.set(scenario.headers ?? {});
      return scenario.body ? test.send(scenario.body) : test;
    };
    const mismatches = (target: ApiRoute, res: { status: number; body: unknown }): unknown[] => {
      if (res.status !== target.status) return [{ status: res.status, body: res.body }];
      const result = (target.response as z.ZodType).safeParse(res.body);
      return result.success ? [] : result.error.issues;
    };

    it.each(Object.entries(scenarios))('%s', async (id, scenario) => {
      const target = route(id);

      expect(mismatches(target, await call(target, scenario))).toEqual([]);
    });

    it('refreshSession', async () => {
      const login = await client(app)
        .post('/api/admin/auth/login')
        .send(scenarios['login']?.body ?? {});
      const [cookie] = login.headers['set-cookie'] as unknown as string[];

      const res = await client(app)
        .post('/api/admin/auth/refresh')
        .set('Cookie', cookie?.split(';')[0] ?? '')
        .set(CSRF_HEADER);

      expect(mismatches(route('refreshSession'), res)).toEqual([]);
    });

    it('finalizeMedia', async () => {
      const key = `uploads/${ADMIN.replace(/[^\w-]/g, '')}/33333333-3333-4333-8333-333333333333.png`;
      infra.storage.upload(key, PNG_BYTES, 'image/png');

      const res = await client(app)
        .post('/api/admin/media')
        .set('Authorization', bearer)
        .send({ storage_key: key, filename: 'a.png', mime_type: 'image/png' });

      expect(mismatches(route('finalizeMedia'), res)).toEqual([]);
    });

    describe('the content lifecycle', () => {
      const ACTION = '44444444-4444-4444-8444-444444444444';
      const act = (id: string, path: string, body?: object) =>
        call(route(id), {
          path: `/api/admin/content/${ACTION}/${path}`,
          ...(body ? { body } : {}),
        });

      it('every step', async () => {
        const body = aTextBody('Text');
        infra.contents.add(aContent({ id: ACTION, slug: 'flow', body, authorId: ADMIN }));

        expect(
          mismatches(
            route('updateContent'),
            await call(route('updateContent'), {
              path: `/api/admin/content/${ACTION}`,
              body: { version: 1, title: 'Edited' },
            }),
          ),
        ).toEqual([]);
        expect(
          mismatches(
            route('scheduleContent'),
            await act('scheduleContent', 'schedule', {
              scheduled_at: new Date(infra.clock.now().getTime() + 60_000).toISOString(),
            }),
          ),
        ).toEqual([]);
        expect(mismatches(route('submitContent'), await act('submitContent', 'submit'))).toEqual(
          [],
        );
        expect(
          mismatches(route('rejectContent'), await act('rejectContent', 'reject', { note: 'No' })),
        ).toEqual([]);
        expect(mismatches(route('publishContent'), await act('publishContent', 'publish'))).toEqual(
          [],
        );
        expect(
          mismatches(route('unpublishContent'), await act('unpublishContent', 'unpublish')),
        ).toEqual([]);
        expect(
          mismatches(
            route('undoUnpublishContent'),
            await act('undoUnpublishContent', 'unpublish/undo'),
          ),
        ).toEqual([]);
        expect(
          mismatches(route('unpublishContent'), await act('unpublishContent', 'unpublish')),
        ).toEqual([]);
        expect(mismatches(route('archiveContent'), await act('archiveContent', 'archive'))).toEqual(
          [],
        );
      });

      it('restoreContent', async () => {
        infra.contents.add(
          aContent({ id: ACTION, slug: 'gone', authorId: ADMIN, deletedAt: infra.clock.now() }),
        );

        expect(mismatches(route('restoreContent'), await act('restoreContent', 'restore'))).toEqual(
          [],
        );
      });

      it('revertContent', async () => {
        const res = await call(route('revertContent'), {
          path: `/api/admin/content/${ID}/revert/1`,
        });

        expect(mismatches(route('revertContent'), res)).toEqual([]);
      });
    });

    it('exportAuditEvents is CSV', async () => {
      const res = await call(route('exportAuditEvents'), {});

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('covers every route that returns a body', () => {
      const covered = new Set([
        ...Object.keys(scenarios),
        'refreshSession',
        'finalizeMedia',
        'updateContent',
        'scheduleContent',
        'submitContent',
        'rejectContent',
        'publishContent',
        'unpublishContent',
        'undoUnpublishContent',
        'archiveContent',
        'restoreContent',
        'revertContent',
        'exportAuditEvents',
      ]);

      const withBody = API_ROUTES.filter((candidate) => candidate.response !== undefined);

      expect(withBody.map((candidate) => candidate.id).filter((id) => !covered.has(id))).toEqual(
        [],
      );
    });

    it.each([
      ['a validation error', () => client(app).post('/api/admin/auth/login').send({})],
      ['an unauthenticated request', () => client(app).get('/api/admin/users')],
      ['a missing route', () => client(app).get('/nothing-here')],
      [
        'a missing item',
        () => client(app).get('/api/v1/articles/nothing').set('X-API-Key', API_KEY),
      ],
    ])('errors match the standard envelope: %s', async (_name, send) => {
      const res = await send();

      const result = errorEnvelope.safeParse(res.body);
      expect(result.success ? [] : result.error.issues).toEqual([]);
    });
  });

  describe('what it says beyond the success body', () => {
    const operation = (id: string) => {
      const route = API_ROUTES.find((candidate) => candidate.id === id) as ApiRoute;
      const paths = document['paths'] as Record<string, Record<string, Record<string, never>>>;
      return (paths[route.path] as Record<string, Record<string, never>>)[route.method] as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
    };

    it('declares the cache headers the public API really sends (FR-PUBAPI-04)', async () => {
      const res = await client(app).get('/api/v1/articles').set('X-API-Key', API_KEY);

      const declared = operation('listArticles')['responses']?.['200']?.['headers'] as object;
      for (const header of Object.keys(declared)) {
        expect(res.headers[header.toLowerCase()]).toBeDefined();
      }
    });

    it('declares a 304, and it really happens', async () => {
      const first = await client(app).get('/api/v1/articles').set('X-API-Key', API_KEY);

      const second = await client(app)
        .get('/api/v1/articles')
        .set('X-API-Key', API_KEY)
        .set('If-None-Match', first.headers['etag'] as string);

      expect(second.status).toBe(304);
      expect(operation('listArticles')['responses']).toHaveProperty('304');
    });

    it('declares 429 with Retry-After where a limit applies', () => {
      for (const id of ['listArticles', 'getPublicMedia', 'login', 'changePassword']) {
        expect(operation(id)['responses']?.['429']).toHaveProperty('headers.Retry-After');
      }
    });

    it('declares a 503 for readiness, and it really happens', async () => {
      infra.readiness.ready = false;

      const res = await client(app).get('/readyz');

      infra.readiness.ready = true;
      expect(res.status).toBe(503);
      expect(operation('getReadiness')['responses']).toHaveProperty('503');
    });

    it.each([
      ['refreshSession', '/api/admin/auth/refresh'],
      ['logout', '/api/admin/auth/logout'],
    ])('declares the header %s needs, and it is really refused without it', async (id, path) => {
      const res = await client(app).post(path);

      expect(res.status).toBe(403);
      expect(operation(id)['parameters']).toContainEqual(
        expect.objectContaining({ name: 'X-Requested-With', in: 'header', required: true }),
      );
    });

    it('marks a body optional only where the API accepts none', () => {
      const body = (id: string) => operation(id)['requestBody'] as unknown as { required: boolean };

      expect(body('rejectContent').required).toBe(false);
      expect(body('login').required).toBe(true);
      expect(body('updateContent').required).toBe(true);
    });

    it('declares ids as UUIDs', () => {
      expect(JSON.stringify(operation('getContent')['responses']?.['200'])).toContain(
        '"format":"uuid"',
      );
    });
  });

  describe('the viewer (FR-PUBAPI-07)', () => {
    it('serves the specification', async () => {
      const res = await client(app).get('/openapi.json').expect(200);

      expect(res.body).toMatchObject({ openapi: '3.1.0' });
      expect(Object.keys((res.body as { paths: object }).paths)).toContain('/api/v1/articles');
    });

    it('prepares the specification once, and lets clients reuse it', async () => {
      const first = await client(app).get('/openapi.json').expect(200);

      expect(first.headers['cache-control']).toBe('public, max-age=300');
      await client(app)
        .get('/openapi.json')
        .set('If-None-Match', first.headers['etag'] as string)
        .expect(304);
    });

    it('tells the page not to ask a third party to validate', async () => {
      const res = await client(app).get('/docs/init.js').expect(200);

      expect(res.text).toContain('validatorUrl: null');
    });

    it('serves a page at /docs that needs nothing from outside', async () => {
      const res = await client(app).get('/docs').expect(200);

      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('/docs/swagger-ui-bundle.js');
      expect(res.text).not.toMatch(/https?:\/\//);
      expect(res.headers['content-security-policy']).toContain("script-src 'self'");
      expect(res.headers['content-security-policy']).not.toContain("script-src 'unsafe-inline'");
    });

    it.each([
      ['/docs/init.js', 'javascript'],
      ['/docs/swagger-ui.css', 'text/css'],
      ['/docs/swagger-ui-bundle.js', 'javascript'],
    ])('serves %s', async (path, type) => {
      const res = await client(app).get(path).expect(200);

      expect(res.headers['content-type']).toContain(type);
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    });

    it('keeps the strict policy on the API itself', async () => {
      const res = await client(app).get('/healthz').expect(200);

      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['content-security-policy']).not.toContain("script-src 'self'");
    });
  });
});
