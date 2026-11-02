import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aContent, aTextBody, after, T0 } from '../../../../../../test/builders/a-content.js';
import { aMediaItem, MEDIA_ID } from '../../../../../../test/builders/a-media-item.js';
import {
  createFakeInfrastructure,
  createTestApp,
  http,
  type FakeInfrastructure,
} from '../../../../../../test/builders/http-app.js';
import type { ContentStatus } from '../../../../content/domain/services/content-lifecycle.service.js';

const KEY_ID = 'key-1';
const API_KEY = 'cmsk_test_key';

interface ListBody {
  data: { slug: string; [field: string]: unknown }[];
  pagination: Record<string, number>;
}

describe('public API endpoints', () => {
  let infra: FakeInfrastructure;
  let app: INestApplication;

  const get = (path: string) => http(app).get(path).set('X-API-Key', API_KEY);
  const published = (slug: string, overrides: Parameters<typeof aContent>[0] = {}) =>
    aContent({
      id: slug,
      slug,
      title: slug,
      status: 'published',
      body: aTextBody('Some text'),
      publishedAt: T0,
      authorId: 'author-1',
      ...overrides,
    });

  beforeEach(async () => {
    infra = createFakeInfrastructure();
    await infra.apiKeys.save(
      (await import('../../../../auth/domain/entities/api-key.entity.js')).ApiKey.restore({
        id: KEY_ID,
        name: 'Test',
        prefix: 'cmsk',
        keyHash: infra.opaqueTokens.hash(API_KEY),
        createdBy: 'admin',
        createdAt: T0,
        lastUsedAt: null,
        revokedAt: null,
      }),
    );
    app = await createTestApp(infra);
  });

  afterEach(() => app.close());

  describe('authentication (FR-PUBAPI-02)', () => {
    const paths = ['articles', 'articles/a', 'pages', 'pages/a', `media/${MEDIA_ID}`];

    it.each(paths)('GET /api/v1/%s returns 401 without a key', async (path) => {
      await http(app).get(`/api/v1/${path}`).expect(401);
    });

    it.each(paths)('GET /api/v1/%s returns 401 for an unknown key', async (path) => {
      await http(app).get(`/api/v1/${path}`).set('X-API-Key', 'wrong').expect(401);
    });

    it('does not accept an admin token instead', async () => {
      const token = await infra.signer.sign({ userId: 'a', role: 'admin' }, 900);

      await http(app).get('/api/v1/articles').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('stops working once revoked', async () => {
      await get('/api/v1/articles').expect(200);

      await infra.apiKeys.revoke(KEY_ID, infra.clock.now());

      await get('/api/v1/articles').expect(401);
    });
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'has no %s route, being read-only (FR-PUBAPI-01)',
    async (method) => {
      await http(app)[method]('/api/v1/articles').set('X-API-Key', API_KEY).expect(404);
    },
  );

  describe('rate limit (SEC-07)', () => {
    it('limits each key, with 429 and Retry-After', async () => {
      const limited = createFakeInfrastructure();
      await limited.apiKeys.save(
        (await import('../../../../auth/domain/entities/api-key.entity.js')).ApiKey.restore({
          id: KEY_ID,
          name: 'Test',
          prefix: 'cmsk',
          keyHash: limited.opaqueTokens.hash(API_KEY),
          createdBy: 'admin',
          createdAt: T0,
          lastUsedAt: null,
          revokedAt: null,
        }),
      );
      const small = await createTestApp({
        ...limited,
        http: {
          ...limited.http,
          rateLimits: {
            ...limited.http.rateLimits,
            publicApi: { limit: 2, windowSeconds: 60 },
          },
        },
      });
      const call = () => http(small).get('/api/v1/articles').set('X-API-Key', API_KEY);

      await call().expect(200);
      await call().expect(200);
      const res = await call().expect(429);

      expect(res.headers['retry-after']).toBe('60');
      await small.close();
    });
  });

  describe('visibility (FR-AUTHZ-06, FR-PUBAPI-03)', () => {
    const hidden: [string, Parameters<typeof aContent>[0]][] = [
      ...(['draft', 'in_review', 'unpublished', 'archived'] as ContentStatus[]).map(
        (status): [string, Parameters<typeof aContent>[0]] => [status, { status }],
      ),
      ['soft-deleted', { deletedAt: T0 }],
      ['published in the future', { publishedAt: after(60 * 24 * 365 * 10) }],
      ['of the other type', { type: 'page' }],
    ];

    it.each(hidden)(
      'hides an article that is %s from the list and by slug',
      async (_name, change) => {
        infra.contents.add(published('secret', change));

        const list = await get('/api/v1/articles').expect(200);

        expect((list.body as ListBody).data).toEqual([]);
        await get('/api/v1/articles/secret').expect(404);
      },
    );

    it('shows a published article', async () => {
      infra.contents.add(published('visible'));

      const list = await get('/api/v1/articles').expect(200);

      expect((list.body as ListBody).data.map((item) => item.slug)).toEqual(['visible']);
      await get('/api/v1/articles/visible').expect(200);
    });

    it('answers 404 the same for a draft and for nothing at all', async () => {
      infra.contents.add(published('draft', { status: 'draft' }));

      const draft = await get('/api/v1/articles/draft').expect(404);
      const nothing = await get('/api/v1/articles/nothing').expect(404);

      expect(draft.body).toEqual(nothing.body);
    });
  });

  describe('articles', () => {
    it('returns the list envelope, newest first, with article fields', async () => {
      infra.contents.add(
        published('old', { publishedAt: after(-2), tags: ['a'], category: 'news' }),
      );
      infra.contents.add(published('new', { publishedAt: after(-1) }));

      const res = await get('/api/v1/articles?page=1&page_size=1').expect(200);

      expect(res.body).toMatchObject({
        data: [{ slug: 'new', author_name: 'Name of author-1', tags: [], category: null }],
        pagination: { page: 1, page_size: 1, total: 2, total_pages: 2 },
      });
    });

    it('filters by tag, whatever its case, and by category', async () => {
      infra.contents.add(published('a', { tags: ['news'] }));
      infra.contents.add(published('b', { category: 'guides' }));
      const slugs = async (query: string) =>
        ((await get(`/api/v1/articles?${query}`).expect(200)).body as ListBody).data.map(
          (item) => item.slug,
        );

      await expect(slugs('tag=NEWS')).resolves.toEqual(['a']);
      await expect(slugs('category=guides')).resolves.toEqual(['b']);
    });

    it.each(['page=0', 'page=x', 'tag=a%00b'])('refuses %s', async (query) => {
      await get(`/api/v1/articles?${query}`).expect(422);
    });

    it('returns one article with its body, SEO defaults, and no internal fields', async () => {
      infra.contents.add(published('one', { reviewNote: 'Internal', tags: ['t'] }));

      const res = await get('/api/v1/articles/one').expect(200);
      const data = (res.body as { data: Record<string, unknown> }).data;

      expect(data).toMatchObject({
        slug: 'one',
        body: aTextBody('Some text'),
        tags: ['t'],
        seo: { title: 'one', description: 'Some text', social_image: null },
      });
      for (const field of ['status', 'version', 'review_note', 'author_id', 'scheduled_at']) {
        expect(data).not.toHaveProperty(field);
      }
    });

    it('never returns executable tags (SEC-04)', async () => {
      infra.contents.add(published('one', { body: aTextBody('Safe') }));

      const res = await get('/api/v1/articles/one').expect(200);

      expect(JSON.stringify(res.body)).not.toMatch(/<script/i);
    });
  });

  describe('pages', () => {
    it('has no author, tags or category (01-Requirements 6.2)', async () => {
      infra.contents.add(published('about', { type: 'page', parentId: 'parent' }));

      const list = await get('/api/v1/pages').expect(200);
      const one = await get('/api/v1/pages/about').expect(200);

      for (const item of [(list.body as ListBody).data[0], (one.body as { data: object }).data]) {
        expect(item).toMatchObject({ slug: 'about', parent_id: 'parent' });
        for (const field of ['author_name', 'tags', 'category']) {
          expect(item).not.toHaveProperty(field);
        }
      }
      expect((one.body as { data: object }).data).toHaveProperty('seo');
    });

    it('does not return an article as a page', async () => {
      infra.contents.add(published('story'));

      await get('/api/v1/pages/story').expect(404);
    });
  });

  describe('media', () => {
    it('shows media used by published content, in the response shape', async () => {
      infra.media.add(aMediaItem({ altText: 'Alt', variantStatus: 'ready' }));
      infra.contents.add(published('one', { featuredImageId: MEDIA_ID }));

      const res = await get(`/api/v1/media/${MEDIA_ID}`).expect(200);

      expect(res.body).toEqual({
        data: {
          id: MEDIA_ID,
          filename: 'hero.png',
          mime_type: 'image/png',
          size_bytes: 1000,
          width: null,
          height: null,
          alt_text: 'Alt',
          caption: null,
          url: expect.stringContaining('https://storage.test/') as string,
          variants: {},
        },
      });
    });

    it('resolves featured, social and inline images in content', async () => {
      infra.media.add(aMediaItem());
      infra.contents.add(
        published('one', {
          featuredImageId: MEDIA_ID,
          socialImageId: MEDIA_ID,
          body: {
            type: 'doc',
            content: [{ type: 'image', attrs: { src: '/old', mediaId: MEDIA_ID } }],
          },
        }),
      );

      const res = await get('/api/v1/articles/one').expect(200);
      const data = (res.body as { data: Record<string, never> }).data;

      expect(data['featured_image']).toMatchObject({ id: MEDIA_ID });
      expect(data['seo']).toMatchObject({ social_image: { id: MEDIA_ID } });
      expect(JSON.stringify(data['body'])).toContain('https://storage.test/');
      expect(JSON.stringify(data['body'])).not.toContain('/old');
    });

    it.each(['draft', 'in_review'] as const)('hides media only a %s uses', async (status) => {
      infra.media.add(aMediaItem());
      infra.contents.add(published('one', { status, featuredImageId: MEDIA_ID }));

      await get(`/api/v1/media/${MEDIA_ID}`).expect(404);
    });

    it('refuses a malformed id', async () => {
      await get('/api/v1/media/nope').expect(422);
    });
  });

  describe('cache headers (FR-PUBAPI-04)', () => {
    beforeEach(() => {
      infra.contents.add(published('one', { updatedAt: after(5) }));
    });

    it.each(['/api/v1/articles', '/api/v1/articles/one'])('%s has all of them', async (path) => {
      const res = await get(path).expect(200);

      expect(res.headers['etag']).toMatch(/^"[\w-]+"$/);
      expect(res.headers['last-modified']).toBe(after(5).toUTCString());
      expect(res.headers['cache-control']).toBe('private, max-age=30');
      expect(res.headers['vary']).toContain('X-API-Key');
    });

    it('answers 304 with no body when the ETag still matches', async () => {
      const first = await get('/api/v1/articles/one').expect(200);

      const second = await get('/api/v1/articles/one')
        .set('If-None-Match', first.headers['etag'] as string)
        .expect(304);

      expect(second.text).toBe('');
    });

    it('answers 200 when the ETag no longer matches', async () => {
      await get('/api/v1/articles/one').set('If-None-Match', '"old"').expect(200);
    });

    it('still requires a key for a conditional request', async () => {
      const first = await get('/api/v1/articles/one').expect(200);

      await http(app)
        .get('/api/v1/articles/one')
        .set('If-None-Match', first.headers['etag'] as string)
        .expect(401);
    });

    it('does not expose a cached response after a key is revoked', async () => {
      await get('/api/v1/articles/one').expect(200);

      await infra.apiKeys.revoke(KEY_ID, infra.clock.now());

      await get('/api/v1/articles/one').expect(401);
    });
  });

  describe('invalidation (FR-CONTENT-12)', () => {
    it.each([['ContentUnpublished'], ['ContentPublished'], ['ContentDeleted'], ['MediaDeleted']])(
      '%s clears the cache at once',
      async (type) => {
        infra.contents.add(published('one'));
        await get('/api/v1/articles').expect(200);
        expect(infra.responseCache.entries.size).toBe(1);

        await infra.events.publishAll([{ type }]);

        expect(infra.responseCache.entries.size).toBe(0);
      },
    );
  });
});
