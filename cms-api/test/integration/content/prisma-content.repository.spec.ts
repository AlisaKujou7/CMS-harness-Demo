import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaContentRepository } from '../../../src/modules/content/adapters/out/persistence/prisma-content.repository.js';
import type { ContentCriteria } from '../../../src/modules/content/application/ports/out/content-repository.port.js';
import type { Content } from '../../../src/modules/content/domain/entities/content.entity.js';
import {
  ConcurrentModificationError,
  SlugConflictError,
} from '../../../src/modules/content/domain/errors/content.errors.js';
import { PrismaMediaRepository } from '../../../src/modules/media/adapters/out/persistence/prisma-media.repository.js';
import { PrismaUserRepository } from '../../../src/modules/users/adapters/out/persistence/prisma-user.repository.js';
import { UserInUseError } from '../../../src/modules/users/domain/errors/user.errors.js';
import { aContent, aTextBody, after, T0 } from '../../builders/a-content.js';
import { aMediaItem } from '../../builders/a-media-item.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const AUTHOR = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PAGE = { page: 1, pageSize: 25 };
const CRITERIA: ContentCriteria = { sortBy: 'updated_at', descending: true };

const item = (n: number, overrides: Parameters<typeof aContent>[0] = {}) =>
  aContent({ id: id(n), slug: `item-${String(n)}`, authorId: AUTHOR, ...overrides });

describe('PrismaContentRepository', () => {
  let db: TestDatabase;
  let repo: PrismaContentRepository;

  const titles = async (criteria: Partial<ContentCriteria>) => {
    const result = await repo.findMany({ ...CRITERIA, ...criteria }, PAGE);
    return result.items.map((row) => row.title);
  };
  const aVersion = (contentId: string, versionNo: number) => ({
    id: `30000000-0000-4000-8000-${String(versionNo).padStart(12, '0')}`,
    contentId,
    versionNo,
    snapshot: {
      title: `V${String(versionNo)}`,
      slug: 's',
      body: aTextBody('x'),
      featuredImageId: null,
      socialImageId: null,
      seoTitle: null,
      seoDescription: null,
      tags: [],
      category: null,
      parentId: null,
      status: 'draft' as const,
    },
    editorId: AUTHOR,
    createdAt: T0,
  });

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new PrismaContentRepository(db.context);
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await db.truncate();
    await db.seedUser(AUTHOR, { name: 'Ann Author' });
    await db.seedUser(OTHER, { name: 'Oli Other' });
  });

  it('stores and restores every field, with the body as a JSON tree (FR-CONTENT-14)', async () => {
    const media = new PrismaMediaRepository(db.context);
    for (const n of [90, 91]) {
      await media.create(
        aMediaItem({ id: id(n), storageKey: `k${String(n)}`, uploadedBy: AUTHOR }),
      );
    }
    const content = item(1, {
      type: 'article',
      title: 'Title',
      body: aTextBody('สวัสดี'),
      status: 'in_review',
      featuredImageId: id(90),
      socialImageId: id(91),
      seoTitle: 'SEO',
      seoDescription: 'Desc',
      tags: ['a', 'b'],
      category: 'news',
      scheduledAt: after(10),
      publishedAt: after(5),
      reviewNote: 'Note',
      version: 7,
      updatedAt: after(1),
    });

    await repo.create(content);

    await expect(repo.findById(id(1))).resolves.toEqual(content);
  });

  it('keeps a page parent, and clears it when the parent is purged', async () => {
    await repo.create(item(1, { type: 'page', deletedAt: after(0) }));
    await repo.create(item(2, { type: 'page', parentId: id(1) }));

    await expect(repo.findById(id(2))).resolves.toMatchObject({ parentId: id(1) });
    await expect(repo.purgeDeletedBefore(after(1), 10)).resolves.toEqual([id(1)]);
    await expect(repo.findById(id(2))).resolves.toMatchObject({ parentId: null });
  });

  it('hides soft-deleted content, which gives up its slug', async () => {
    await repo.create(item(1, { slug: 'kept' }));
    await expect(repo.slugExists('article', 'kept')).resolves.toBe(true);
    await expect(repo.slugExists('page', 'kept')).resolves.toBe(false);

    await repo.save(item(1, { slug: 'kept', version: 2, deletedAt: T0 }));

    await expect(repo.findById(id(1))).resolves.toBeNull();
    await expect(repo.slugExists('article', 'kept')).resolves.toBe(false);
    await expect(repo.create(item(2, { slug: 'kept' }))).resolves.toBeUndefined();
  });

  describe('slug uniqueness (FR-CONTENT-03)', () => {
    it('refuses a duplicate per type on create, and allows it across types', async () => {
      await repo.create(item(1, { slug: 'same' }));

      await expect(repo.create(item(2, { slug: 'same' }))).rejects.toThrow(SlugConflictError);
      await expect(repo.create(item(3, { slug: 'same', type: 'page' }))).resolves.toBeUndefined();
    });

    it('refuses a duplicate on save', async () => {
      await repo.create(item(1, { slug: 'taken' }));
      await repo.create(item(2));

      await expect(repo.save(item(2, { slug: 'taken', version: 2 }))).rejects.toThrow(
        SlugConflictError,
      );
    });
  });

  describe('save', () => {
    it('writes over the version it was made from', async () => {
      await repo.create(item(1, { version: 3 }));

      await repo.save(item(1, { version: 4, title: 'New', tags: ['t'] }));

      await expect(repo.findById(id(1))).resolves.toMatchObject({
        title: 'New',
        version: 4,
        tags: ['t'],
      });
    });

    it('refuses a write from a stale version and changes nothing', async () => {
      await repo.create(item(1, { version: 5, title: 'Current' }));

      await expect(repo.save(item(1, { version: 4, title: 'Stale' }))).rejects.toThrow(
        ConcurrentModificationError,
      );
      await expect(repo.findById(id(1))).resolves.toMatchObject({ title: 'Current', version: 5 });
    });

    it('lets exactly one of two simultaneous writers win', async () => {
      await repo.create(item(1));
      const current = (await repo.findById(id(1))) as Content;
      const write = (title: string) =>
        db.context.run(() => repo.save(current.edit({ title }, after(1))));

      const results = await Promise.allSettled([write('A'), write('B')]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      await expect(repo.findById(id(1))).resolves.toMatchObject({ version: 2 });
    });

    it('can soft delete', async () => {
      await repo.create(item(1));

      await repo.save(item(1, { version: 2, deletedAt: T0 }));

      await expect(repo.findById(id(1))).resolves.toBeNull();
    });
  });

  describe('findMany', () => {
    beforeEach(async () => {
      await repo.create(
        item(1, { title: 'Apple 100%', tags: ['fruit'], updatedAt: after(1), createdAt: after(3) }),
      );
      await repo.create(
        item(2, { title: 'Banana', authorId: OTHER, status: 'published', updatedAt: after(2) }),
      );
      await repo.create(item(3, { title: 'Page', type: 'page', updatedAt: after(3) }));
      await repo.create(item(4, { title: 'Archived', status: 'archived', updatedAt: after(4) }));
      await repo.create(item(5, { title: 'Deleted', deletedAt: T0, updatedAt: after(5) }));
    });

    it('leaves out deleted and archived items by default, newest first', async () => {
      await expect(titles({})).resolves.toEqual(['Page', 'Banana', 'Apple 100%']);
    });

    it('filters by status, type, author and tag', async () => {
      await expect(titles({ status: 'archived' })).resolves.toEqual(['Archived']);
      await expect(titles({ type: 'page' })).resolves.toEqual(['Page']);
      await expect(titles({ authorId: OTHER })).resolves.toEqual(['Banana']);
      await expect(titles({ tag: 'fruit' })).resolves.toEqual(['Apple 100%']);
    });

    it('filters by a date range on the last update, inclusive', async () => {
      await expect(titles({ updatedFrom: after(2), updatedTo: after(2) })).resolves.toEqual([
        'Banana',
      ]);
      await expect(titles({ updatedFrom: after(3) })).resolves.toEqual(['Page']);
      await expect(titles({ updatedTo: after(1) })).resolves.toEqual(['Apple 100%']);
    });

    it('searches titles by case-insensitive part (FR-CONTENT-11)', async () => {
      await expect(titles({ search: 'APPL' })).resolves.toEqual(['Apple 100%']);
    });

    it.each([
      ['%', ['Apple 100%']],
      ['_', []],
      ['\\', []],
    ])('treats %s in a search as itself', async (search, expected) => {
      await expect(titles({ search })).resolves.toEqual(expected);
    });

    it('sorts by title and by creation time, in either direction', async () => {
      await expect(titles({ sortBy: 'title', descending: false })).resolves.toEqual([
        'Apple 100%',
        'Banana',
        'Page',
      ]);
      const byCreated = await titles({ sortBy: 'created_at', descending: true });
      expect(byCreated[0]).toBe('Apple 100%');
    });

    it('pages, and gives the author name without the body', async () => {
      const result = await repo.findMany(CRITERIA, { page: 2, pageSize: 1 });

      expect(result).toMatchObject({ page: 2, pageSize: 1, total: 3, totalPages: 3 });
      expect(result.items[0]).toMatchObject({ title: 'Banana', authorName: 'Oli Other' });
      expect(result.items[0]).not.toHaveProperty('body');
    });
  });

  it('counts by status, optionally for one author, leaving out deleted items', async () => {
    await repo.create(item(1));
    await repo.create(item(2, { authorId: OTHER }));
    await repo.create(item(3, { status: 'published' }));
    await repo.create(item(4, { deletedAt: T0 }));

    await expect(repo.countByStatus(null)).resolves.toEqual({
      draft: 2,
      in_review: 0,
      published: 1,
      unpublished: 0,
      archived: 0,
    });
    await expect(repo.countByStatus(OTHER)).resolves.toMatchObject({ draft: 1, published: 0 });
  });

  describe('what is public (FR-PUBAPI-03, RK-04)', () => {
    const NOW = after(60);
    const live = { status: 'published' as const, publishedAt: after(1) };
    const listed = async (criteria: Partial<Parameters<typeof repo.findPublished>[0]> = {}) => {
      const result = await repo.findPublished({ type: 'article', ...criteria }, PAGE, NOW);
      return result.items.map((row) => row.slug);
    };

    it.each([
      ['a draft', { status: 'draft' as const }],
      ['in review', { status: 'in_review' as const }],
      ['unpublished', { status: 'unpublished' as const }],
      ['archived', { status: 'archived' as const }],
      ['soft-deleted', { deletedAt: T0 }],
      ['published later than now', { publishedAt: after(61) }],
      ['with no publish date', { publishedAt: null }],
      ['of another type', { type: 'page' as const }],
    ])('excludes content that is %s', async (_name, change) => {
      await repo.create(item(1, { ...live, slug: 'hidden', ...change }));

      await expect(listed()).resolves.toEqual([]);
      await expect(repo.findPublishedBySlug('article', 'hidden', NOW)).resolves.toBeNull();
    });

    it('includes content published exactly now', async () => {
      await repo.create(item(1, { ...live, slug: 'now', publishedAt: NOW }));

      await expect(listed()).resolves.toEqual(['now']);
    });

    it('lists newest first with the author, the featured image id, and no body', async () => {
      await repo.create(item(1, { ...live, slug: 'old', tags: ['x'], category: 'news' }));
      await repo.create(item(2, { ...live, slug: 'new', publishedAt: after(2) }));

      const result = await repo.findPublished({ type: 'article' }, { page: 1, pageSize: 1 }, NOW);

      expect(result).toMatchObject({ total: 2, totalPages: 2 });
      expect(result.items[0]).toMatchObject({ slug: 'new', authorName: 'Ann Author' });
      expect(result.items[0]).not.toHaveProperty('body');
      await expect(listed({ tag: 'x' })).resolves.toEqual(['old']);
      await expect(listed({ tag: 'y' })).resolves.toEqual([]);
      await expect(listed({ category: 'news' })).resolves.toEqual(['old']);
    });

    it('finds one by slug, with its author', async () => {
      await repo.create(item(1, { ...live, slug: 'one', title: 'One' }));

      const found = await repo.findPublishedBySlug('article', 'one', NOW);

      expect(found?.content.title).toBe('One');
      expect(found?.authorName).toBe('Ann Author');
    });

    it('names a parent only when it is public itself (RK-04)', async () => {
      await repo.create(item(1, { ...live, type: 'page', slug: 'live', title: 'Live' }));
      await repo.create(item(2, { type: 'page', slug: 'draft', title: 'Draft' }));
      await repo.create(item(3, { ...live, type: 'page', slug: 'gone', deletedAt: T0 }));
      await repo.create(item(4, { ...live, type: 'page', slug: 'later', publishedAt: after(61) }));
      await repo.create(item(5, { ...live, type: 'page', slug: 'unset', publishedAt: null }));
      const childOf = async (n: number, slug: string) => {
        await repo.create(item(n + 10, { ...live, type: 'page', slug, parentId: id(n) }));
        const found = await repo.findPublishedBySlug('page', slug, NOW);
        return found?.parent;
      };

      await expect(childOf(1, 'c1')).resolves.toEqual({ slug: 'live', title: 'Live' });
      await expect(childOf(2, 'c2')).resolves.toBeNull();
      await expect(childOf(3, 'c3')).resolves.toBeNull();
      await expect(childOf(4, 'c4')).resolves.toBeNull();
      await expect(childOf(5, 'c5')).resolves.toBeNull();

      const list = await repo.findPublished({ type: 'page' }, PAGE, NOW);
      const parents = Object.fromEntries(list.items.map((row) => [row.slug, row.parent]));
      expect(parents['c1']).toEqual({ slug: 'live', title: 'Live' });
      expect(parents['c2']).toBeNull();
    });

    it('counts only public use of media', async () => {
      const media = new PrismaMediaRepository(db.context);
      await media.create(aMediaItem({ id: id(90), storageKey: 'k', uploadedBy: AUTHOR }));
      await repo.create(item(1, { ...live, slug: 'a', featuredImageId: id(90) }));
      await repo.create(item(2, { slug: 'b', featuredImageId: id(90) }));

      await expect(repo.countPublishedMediaUsage(id(90), NOW)).resolves.toBe(1);
    });
  });

  it('knows whether a page has live children', async () => {
    await repo.create(item(1, { type: 'page' }));
    await expect(repo.hasChildren(id(1))).resolves.toBe(false);

    await repo.create(item(2, { type: 'page', parentId: id(1), deletedAt: T0 }));
    await expect(repo.hasChildren(id(1))).resolves.toBe(false);

    await repo.create(item(3, { type: 'page', parentId: id(1) }));
    await expect(repo.hasChildren(id(1))).resolves.toBe(true);
  });

  describe('findDeletedById', () => {
    it('finds only what has been soft deleted', async () => {
      await repo.create(item(1));
      await expect(repo.findDeletedById(id(1))).resolves.toBeNull();

      const stored = await repo.findById(id(1));
      if (!stored) throw new Error('Expected the item to exist');
      await repo.save(stored.softDelete(new Date('2026-05-02T00:00:00Z')));

      await expect(repo.findDeletedById(id(1))).resolves.toMatchObject({ id: id(1) });
      await expect(repo.findById(id(1))).resolves.toBeNull();
    });
  });

  describe('versions', () => {
    beforeEach(() => repo.create(item(1)));

    it('stores, lists newest first without snapshots, and finds one', async () => {
      await repo.addVersion(aVersion(id(1), 1), 50);
      await repo.addVersion(aVersion(id(1), 2), 50);

      const list = await repo.findVersions(id(1), PAGE);
      expect(list.items.map((version) => version.versionNo)).toEqual([2, 1]);
      expect(list.total).toBe(2);
      expect(list.items[0]).not.toHaveProperty('snapshot');
      expect(list.items[0]).toMatchObject({ editorName: 'Ann Author' });

      await expect(repo.findVersion(id(1), 2)).resolves.toEqual(aVersion(id(1), 2));
      await expect(repo.findVersion(id(1), 9)).resolves.toBeNull();
    });

    it('prunes all but the newest it was told to keep (02-SRS 6.4)', async () => {
      for (let n = 1; n <= 5; n += 1) await repo.addVersion(aVersion(id(1), n), 3);

      const list = await repo.findVersions(id(1), PAGE);
      expect(list.items.map((version) => version.versionNo)).toEqual([5, 4, 3]);
    });

    it('goes with the item when it is purged', async () => {
      await repo.addVersion(aVersion(id(1), 1), 50);
      await repo.save(item(1, { version: 2, deletedAt: T0 }));

      await repo.purgeDeletedBefore(after(1), 10);

      await expect(repo.findVersions(id(1), PAGE)).resolves.toMatchObject({ total: 0 });
    });

    it('can record a change made by no user', async () => {
      await repo.addVersion({ ...aVersion(id(1), 1), editorId: null }, 50);

      await expect(repo.findVersion(id(1), 1)).resolves.toMatchObject({ editorId: null });
    });
  });

  it('finds what is due, oldest first, up to a limit', async () => {
    await repo.create(item(1, { scheduledAt: after(2) }));
    await repo.create(item(2, { scheduledAt: after(1) }));
    await repo.create(item(3, { scheduledAt: after(10) }));
    await repo.create(item(4, { scheduledAt: after(1), deletedAt: T0 }));
    await repo.create(item(5));

    await expect(repo.findDueForPublish(after(5), 10)).resolves.toEqual([id(2), id(1)]);
    await expect(repo.findDueForPublish(after(5), 1)).resolves.toEqual([id(2)]);
  });

  it('purges only what was deleted before the cutoff', async () => {
    await repo.create(item(1, { deletedAt: after(1) }));
    await repo.create(item(2, { deletedAt: after(3) }));
    await repo.create(item(3));

    await expect(repo.purgeDeletedBefore(after(2), 10)).resolves.toEqual([id(1)]);
    await expect(db.context.client.content.count()).resolves.toBe(2);
  });

  it('purges the oldest first and no more than the limit', async () => {
    await repo.create(item(1, { deletedAt: after(2) }));
    await repo.create(item(2, { deletedAt: after(1) }));

    await expect(repo.purgeDeletedBefore(after(3), 1)).resolves.toEqual([id(2)]);
    await expect(db.context.client.content.count()).resolves.toBe(1);
  });

  it('stops a user who wrote content being deleted', async () => {
    await repo.create(item(1));

    await expect(new PrismaUserRepository(db.context).delete(AUTHOR)).rejects.toThrow(
      UserInUseError,
    );
  });
});
