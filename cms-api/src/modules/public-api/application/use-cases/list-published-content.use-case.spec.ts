import { beforeEach, describe, expect, it } from 'vitest';
import {
  FakePublicMediaReader,
  FakePublishedContentReader,
  InMemoryResponseCache,
} from '../../../../../test/fakes/public-api.fakes.js';
import { FakeClock } from '../../../../../test/fakes/system.fakes.js';
import type { PublicMediaRecord, PublishedDetailRecord } from '../ports/out/public-sources.port.js';
import type { PublicApiDeps } from '../public-api-deps.js';
import { ListPublishedContent } from './list-published-content.use-case.js';
import {
  GetPublicMedia,
  GetPublishedContent,
  InvalidatePublicCache,
  PublicItemNotFoundError,
} from './read-public-item.use-case.js';

const MEDIA_ID = 'media-1';
const UPDATED = new Date('2026-05-02T00:00:00Z');

const aRecord = (overrides: Partial<PublishedDetailRecord> = {}): PublishedDetailRecord => ({
  id: 'c1',
  title: 'Title',
  slug: 'a-slug',
  authorName: 'Ann',
  tags: ['t'],
  category: 'news',
  parentId: null,
  featuredImageId: null,
  socialImageId: null,
  version: 3,
  publishedAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: UPDATED,
  body: { type: 'doc', content: [] },
  effectiveSeo: { title: 'SEO', description: 'Desc' },
  ...overrides,
});

const aMedia = (overrides: Partial<PublicMediaRecord> = {}): PublicMediaRecord => ({
  id: MEDIA_ID,
  filename: 'a.png',
  mimeType: 'image/png',
  sizeBytes: 5,
  width: 10,
  height: 20,
  altText: 'Alt',
  caption: null,
  url: 'https://signed/a.png',
  variants: {},
  variantStatus: 'ready',
  createdAt: new Date('2026-04-01T00:00:00Z'),
  ...overrides,
});

describe('public API use cases', () => {
  let content: FakePublishedContentReader;
  let mediaReader: FakePublicMediaReader;
  let responseCache: InMemoryResponseCache;
  let clock: FakeClock;
  let deps: PublicApiDeps;

  beforeEach(() => {
    content = new FakePublishedContentReader();
    mediaReader = new FakePublicMediaReader();
    responseCache = new InMemoryResponseCache();
    clock = new FakeClock('2026-06-01T00:00:00Z');
    deps = {
      content,
      mediaReader,
      responseCache,
      clock,
      publicApiConfig: { cacheTtlSeconds: 30, urlRefreshSeconds: 1800 },
    };
  });

  describe('ListPublishedContent (FR-PUBAPI-05)', () => {
    const list = (command: Partial<Parameters<ListPublishedContent['execute']>[0]> = {}) =>
      new ListPublishedContent(deps).execute({ type: 'article', ...command });

    it('returns items as plain text fields, with pagination', async () => {
      content.items.push(aRecord());

      const { data, lastModified } = await list();

      expect(data.items[0]).toEqual({
        id: 'c1',
        title: 'Title',
        slug: 'a-slug',
        authorName: 'Ann',
        tags: ['t'],
        category: 'news',
        parentId: null,
        featuredImage: null,
        publishedAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
      });
      expect(data.pagination).toEqual({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
      expect(lastModified).toBe(UPDATED.toUTCString());
    });

    it('passes on only the filters that were given', async () => {
      await list({ type: 'page' });
      await list({ tag: 'x', category: 'y' });

      expect(content.queries).toEqual([
        { type: 'page' },
        { type: 'article', tag: 'x', category: 'y' },
      ]);
    });

    it('caps the page size at 100', async () => {
      const { data } = await list({ pageSize: 500, page: 2 });

      expect(data.pagination).toMatchObject({ page: 2, pageSize: 100 });
    });

    it('includes the featured image, and no image if its media is gone', async () => {
      content.items.push(aRecord({ featuredImageId: MEDIA_ID }));
      content.items.push(aRecord({ id: 'c2', featuredImageId: 'gone' }));
      mediaReader.records.push(aMedia());

      const { data } = await list();

      expect(data.items[0]?.featuredImage).toMatchObject({
        id: MEDIA_ID,
        url: 'https://signed/a.png',
      });
      expect(data.items[0]?.featuredImage).not.toHaveProperty('createdAt');
      expect(data.items[1]?.featuredImage).toBeNull();
    });

    it('asks for no media when no item has any', async () => {
      content.items.push(aRecord());
      mediaReader.findByIds = () => Promise.reject(new Error('should not be called'));

      await expect(list()).resolves.toBeDefined();
    });

    it('has a stable date for an empty list', async () => {
      await expect(list()).resolves.toMatchObject({ lastModified: new Date(0).toUTCString() });
    });

    describe('cache', () => {
      it('serves a repeat from the cache, for the configured time', async () => {
        content.items.push(aRecord());

        const first = await list();
        const second = await list();

        expect(second).toEqual(first);
        expect(content.reads).toBe(1);
        expect(responseCache.ttls).toEqual([30]);
      });

      it.each([
        [{ page: 2 }],
        [{ pageSize: 5 }],
        [{ tag: 'x' }],
        [{ category: 'y' }],
        [{ type: 'page' as const }],
      ])('keeps %j apart', async (command) => {
        await list();
        await list(command);

        expect(content.reads).toBe(2);
      });

      it('reads again after invalidation', async () => {
        await list();
        await new InvalidatePublicCache(deps).execute();
        await list();

        expect(content.reads).toBe(2);
      });
    });

    describe('cacheTag (FR-CONTENT-12: "ETag of list endpoint changes")', () => {
      const tag = async () => {
        await new InvalidatePublicCache(deps).execute();
        return (await list()).cacheTag;
      };

      it('stays the same while nothing changes, ignoring signed URLs and time', async () => {
        content.items.push(aRecord());
        const before = await tag();

        clock.advanceMinutes(600);

        await expect(tag()).resolves.toBe(before);
      });

      it('changes when an item is edited', async () => {
        content.items.push(aRecord());
        const before = await tag();

        content.items[0] = aRecord({ version: 4 });

        await expect(tag()).resolves.not.toBe(before);
      });

      it('changes when an item leaves the list', async () => {
        content.items.push(aRecord(), aRecord({ id: 'c2' }));
        const before = await tag();

        content.items.pop();

        await expect(tag()).resolves.not.toBe(before);
      });

      it('changes when an item leaves a later page', async () => {
        content.items.push(aRecord(), aRecord({ id: 'c2' }));
        const firstPage = async () => {
          await new InvalidatePublicCache(deps).execute();
          return (await list({ pageSize: 1 })).cacheTag;
        };
        const before = await firstPage();

        content.items.pop();

        await expect(firstPage()).resolves.not.toBe(before);
      });

      it('differs between pages', async () => {
        const first = (await list({ page: 1 })).cacheTag;
        const second = (await list({ page: 2 })).cacheTag;

        expect(second).not.toBe(first);
      });

      describe('with media', () => {
        beforeEach(() => {
          content.items.push(aRecord({ featuredImageId: MEDIA_ID }));
          mediaReader.records.push(aMedia());
        });

        it('stays the same with new signed URLs in the same time slot', async () => {
          const before = await tag();

          mediaReader.records[0] = aMedia({ url: 'https://signed/other' });
          clock.advanceMinutes(5);

          await expect(tag()).resolves.toBe(before);
        });

        it('changes before signed URLs could expire, so nobody revalidates past them', async () => {
          const before = await tag();

          clock.advanceMinutes(31);

          await expect(tag()).resolves.not.toBe(before);
        });

        it.each([
          ['variants become ready', { variantStatus: 'pending' }],
          ['the alt text changes', { altText: 'Other' }],
          ['the caption changes', { caption: 'Cap' }],
          ['dimensions arrive', { width: 11 }],
          ['height arrives', { height: 21 }],
        ])('changes when %s', async (_name, change) => {
          const before = await tag();

          mediaReader.records[0] = aMedia(change);

          await expect(tag()).resolves.not.toBe(before);
        });

        it('does not depend on the order media comes back in', async () => {
          content.items.push(aRecord({ id: 'c2', featuredImageId: 'media-2' }));
          mediaReader.records.push(aMedia({ id: 'media-2' }));
          const before = await tag();

          mediaReader.records.reverse();

          await expect(tag()).resolves.toBe(before);
        });
      });
    });
  });

  describe('GetPublishedContent (FR-PUBAPI-03, FR-SEO-03)', () => {
    const get = (slug = 'a-slug') =>
      new GetPublishedContent(deps).execute({ type: 'article', slug });

    it('returns the body and SEO fields', async () => {
      content.items.push(aRecord({ socialImageId: MEDIA_ID }));
      mediaReader.records.push(aMedia());

      const { data, lastModified } = await get();

      expect(data.body).toEqual({ type: 'doc', content: [] });
      expect(data.seo).toMatchObject({
        title: 'SEO',
        description: 'Desc',
        socialImage: { id: MEDIA_ID },
      });
      expect(data.featuredImage).toBeNull();
      expect(lastModified).toBe(UPDATED.toUTCString());
    });

    it('has no social image when its media is gone', async () => {
      content.items.push(aRecord({ socialImageId: 'gone' }));

      const { data } = await get();

      expect(data.seo.socialImage).toBeNull();
    });

    it('gives inline images a current URL and dimensions, and removes deleted ones', async () => {
      content.items.push(
        aRecord({
          body: {
            type: 'doc',
            content: [
              { type: 'image', attrs: { src: '/expired', mediaId: MEDIA_ID, alt: 'Own alt' } },
              { type: 'image', attrs: { src: '/expired', mediaId: 'gone' } },
              { type: 'image', attrs: { src: 'https://elsewhere/x.png' } },
              { type: 'image' },
              {
                type: 'blockquote',
                content: [
                  { type: 'image', attrs: { src: '/old', mediaId: MEDIA_ID } },
                  { type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] },
                  { type: 'horizontalRule' },
                ],
              },
            ],
          },
        }),
      );
      mediaReader.records.push(aMedia());

      const { data } = await get();

      expect(data.body.content).toEqual([
        {
          type: 'image',
          attrs: {
            src: 'https://signed/a.png',
            mediaId: MEDIA_ID,
            alt: 'Own alt',
            width: 10,
            height: 20,
          },
        },
        { type: 'image', attrs: { src: 'https://elsewhere/x.png' } },
        { type: 'image' },
        {
          type: 'blockquote',
          content: [
            {
              type: 'image',
              attrs: {
                src: 'https://signed/a.png',
                mediaId: MEDIA_ID,
                alt: 'Alt',
                width: 10,
                height: 20,
              },
            },
            { type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] },
            { type: 'horizontalRule' },
          ],
        },
      ]);
    });

    it('asks for each media once', async () => {
      content.items.push(
        aRecord({
          featuredImageId: MEDIA_ID,
          socialImageId: MEDIA_ID,
          body: { type: 'doc', content: [{ type: 'image', attrs: { mediaId: MEDIA_ID } }] },
        }),
      );
      const asked: string[][] = [];
      mediaReader.findByIds = (ids) => {
        asked.push([...ids]);
        return Promise.resolve([]);
      };

      await get();

      expect(asked).toEqual([[MEDIA_ID]]);
    });

    it('asks for no media when there is none', async () => {
      content.items.push(aRecord());
      mediaReader.findByIds = () => Promise.reject(new Error('should not be called'));

      await expect(get()).resolves.toBeDefined();
    });

    it('reports what is not public as not found, and does not cache that', async () => {
      await expect(get()).rejects.toThrow(PublicItemNotFoundError);
      expect(responseCache.entries.size).toBe(0);

      content.items.push(aRecord());
      await expect(get()).resolves.toBeDefined();
    });

    it.each(['UPPER', 'has space', 'a--b', '-a', 'a\0b', 'a'.repeat(201)])(
      'does not look up the impossible slug %j',
      async (slug) => {
        await expect(get(slug)).rejects.toThrow(PublicItemNotFoundError);
        expect(content.reads).toBe(0);
      },
    );

    it('accepts the longest possible slug', async () => {
      const slug = 'a'.repeat(200);
      content.items.push(aRecord({ slug }));

      await expect(get(slug)).resolves.toBeDefined();
    });

    it('caches per slug and type', async () => {
      content.items.push(aRecord());

      await get();
      await get();
      expect(content.reads).toBe(1);

      await new GetPublishedContent(deps).execute({ type: 'page', slug: 'a-slug' });
      expect(content.reads).toBe(2);
    });

    it('changes its tag with the version, but not with time when it has no media', async () => {
      content.items.push(aRecord());
      const tag = async () => {
        await new InvalidatePublicCache(deps).execute();
        return (await get()).cacheTag;
      };
      const before = await tag();

      clock.advanceMinutes(600);
      await expect(tag()).resolves.toBe(before);

      content.items[0] = aRecord({ version: 4 });
      await expect(tag()).resolves.not.toBe(before);
    });
  });

  describe('GetPublicMedia', () => {
    const get = () => new GetPublicMedia(deps).execute({ id: MEDIA_ID });

    it('returns media that published content uses', async () => {
      mediaReader.records.push(aMedia());
      content.usage.set(MEDIA_ID, 1);

      const result = await get();

      expect(result.data).toMatchObject({ id: MEDIA_ID, url: 'https://signed/a.png' });
      expect(result.lastModified).toBe(new Date('2026-04-01T00:00:00Z').toUTCString());
      expect(result.cacheTag).toContain(MEDIA_ID);
    });

    it('hides media that no published content uses, as it may belong to a draft (RK-04)', async () => {
      mediaReader.records.push(aMedia());

      await expect(get()).rejects.toThrow(PublicItemNotFoundError);
    });

    it('reports media that no longer exists', async () => {
      content.usage.set(MEDIA_ID, 1);

      await expect(get()).rejects.toThrow(PublicItemNotFoundError);
    });

    it('answers the same way for each, so nothing is confirmed', async () => {
      await expect(get()).rejects.toMatchObject({ kind: 'not_found', code: 'NOT_FOUND' });
    });
  });
});
