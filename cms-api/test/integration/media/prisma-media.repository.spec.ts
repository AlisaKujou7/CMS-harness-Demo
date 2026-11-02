import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaContentRepository } from '../../../src/modules/content/adapters/out/persistence/prisma-content.repository.js';
import { PrismaMediaRepository } from '../../../src/modules/media/adapters/out/persistence/prisma-media.repository.js';
import { MediaAlreadyExistsError } from '../../../src/modules/media/domain/errors/media.errors.js';
import { PrismaUserRepository } from '../../../src/modules/users/adapters/out/persistence/prisma-user.repository.js';
import { UserInUseError } from '../../../src/modules/users/domain/errors/user.errors.js';
import { aContent, aTextBody } from '../../builders/a-content.js';
import { aMediaItem } from '../../builders/a-media-item.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const USER = '10000000-0000-4000-8000-000000000001';
const OTHER = '10000000-0000-4000-8000-000000000002';
const id = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const contentId = (n: number) => `60000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PAGE = { page: 1, pageSize: 25 };
const at = (day: number) => new Date(Date.UTC(2026, 0, day));

const item = (n: number, overrides: Parameters<typeof aMediaItem>[0] = {}) =>
  aMediaItem({ id: id(n), storageKey: `media/${String(n)}`, uploadedBy: USER, ...overrides });

describe('PrismaMediaRepository', () => {
  let db: TestDatabase;
  let repo: PrismaMediaRepository;
  let contents: PrismaContentRepository;

  const names = async (criteria: Parameters<PrismaMediaRepository['findMany']>[0]) =>
    (await repo.findMany(criteria, PAGE)).items.map(({ item: media }) => media.filename);

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new PrismaMediaRepository(db.context);
    contents = new PrismaContentRepository(db.context);
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await db.truncate();
    await db.seedUser(USER, { name: 'Ann' });
    await db.seedUser(OTHER, { name: 'Oli' });
  });

  it('stores and restores every field, and a size beyond 32 bits', async () => {
    const media = item(1, {
      sizeBytes: 5_000_000_000,
      altText: 'Alt',
      caption: 'Cap',
      variantStatus: 'none',
    });

    await repo.create(media);

    await expect(repo.findById(id(1))).resolves.toEqual(media);
    await expect(repo.findById(id(9))).resolves.toBeNull();
  });

  it('refuses the same upload twice, by id or storage key', async () => {
    await repo.create(item(1));

    await expect(repo.create(item(1, { storageKey: 'other' }))).rejects.toThrow(
      MediaAlreadyExistsError,
    );
    await expect(repo.create(item(2, { storageKey: 'media/1' }))).rejects.toThrow(
      MediaAlreadyExistsError,
    );
  });

  it('gives the uploader name with one item', async () => {
    await repo.create(item(1));

    await expect(repo.findWithUploader(id(1))).resolves.toMatchObject({ uploaderName: 'Ann' });
    await expect(repo.findWithUploader(id(9))).resolves.toBeNull();
  });

  describe('findMany', () => {
    beforeEach(async () => {
      await repo.create(
        item(1, { filename: 'hero 100%.png', altText: 'Sunset', createdAt: at(1) }),
      );
      await repo.create(
        item(2, {
          filename: 'faq.pdf',
          mimeType: 'application/pdf',
          uploadedBy: OTHER,
          createdAt: at(2),
        }),
      );
      await repo.create(
        item(3, { filename: 'logo.svg', mimeType: 'image/svg+xml', createdAt: at(3) }),
      );
    });

    it('lists newest first, with uploader names', async () => {
      const result = await repo.findMany({}, { page: 2, pageSize: 1 });

      expect(result).toMatchObject({ page: 2, total: 3, totalPages: 3 });
      expect(result.items[0]).toMatchObject({ uploaderName: 'Oli' });
      await expect(names({})).resolves.toEqual(['logo.svg', 'faq.pdf', 'hero 100%.png']);
    });

    it('searches filename and alt text, case-insensitively (FR-MEDIA-08)', async () => {
      await expect(names({ search: 'HERO' })).resolves.toEqual(['hero 100%.png']);
      await expect(names({ search: 'sunset' })).resolves.toEqual(['hero 100%.png']);
    });

    it.each([
      ['%', ['hero 100%.png']],
      ['_', []],
    ])('treats %s in a search as itself', async (search, expected) => {
      await expect(names({ search })).resolves.toEqual(expected);
    });

    it('filters by uploader, kind and date range', async () => {
      await expect(names({ uploadedBy: OTHER })).resolves.toEqual(['faq.pdf']);
      await expect(names({ kind: 'document' })).resolves.toEqual(['faq.pdf']);
      await expect(names({ kind: 'image' })).resolves.toEqual(['logo.svg', 'hero 100%.png']);
      await expect(names({ from: at(2), to: at(2) })).resolves.toEqual(['faq.pdf']);
      await expect(names({ from: at(3) })).resolves.toEqual(['logo.svg']);
      await expect(names({ to: at(1) })).resolves.toEqual(['hero 100%.png']);
    });
  });

  it('names the ids that do not exist', async () => {
    await repo.create(item(1));

    await expect(repo.findMissing([id(1), id(2)])).resolves.toEqual([id(2)]);
  });

  it('updates only the metadata it was given', async () => {
    await repo.create(item(1, { altText: 'Alt', caption: 'Cap' }));

    await repo.updateMetadata(id(1), { caption: null });

    await expect(repo.findById(id(1))).resolves.toMatchObject({ altText: 'Alt', caption: null });
  });

  it('saves variants, and says when the item is gone', async () => {
    await repo.create(item(1));
    const variants = { thumbnail: { key: 'k', width: 320, height: 160 } };

    await expect(
      repo.saveVariants(id(1), { width: 640, height: 320, variants, status: 'ready' }),
    ).resolves.toBe(true);
    await expect(repo.findById(id(1))).resolves.toMatchObject({
      width: 640,
      height: 320,
      variants,
      variantStatus: 'ready',
    });

    await expect(
      repo.saveVariants(id(2), { width: null, height: null, variants: {}, status: 'failed' }),
    ).resolves.toBe(false);
  });

  it('finds pending variants older than the cutoff, oldest first, up to a limit', async () => {
    await repo.create(item(1, { createdAt: at(2) }));
    await repo.create(item(2, { createdAt: at(1) }));
    await repo.create(item(3, { createdAt: at(5) }));
    await repo.create(item(4, { createdAt: at(1), variantStatus: 'ready' }));

    await expect(repo.findPendingVariants(at(3), 10)).resolves.toEqual([id(2), id(1)]);
    await expect(repo.findPendingVariants(at(3), 1)).resolves.toEqual([id(2)]);
  });

  describe('references from content (FR-MEDIA-07)', () => {
    const body = (mediaId: string) => ({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '/a', mediaId } }],
    });
    const content = (n: number, overrides: Parameters<typeof aContent>[0] = {}) =>
      aContent({ id: contentId(n), slug: `c-${String(n)}`, authorId: USER, ...overrides });

    beforeEach(async () => {
      await repo.create(item(1));
      await repo.create(item(2));
    });

    it('counts every kind of reference from live content, once each', async () => {
      await contents.create(content(1, { featuredImageId: id(1) }));
      await contents.create(content(2, { socialImageId: id(1) }));
      await contents.create(content(3, { body: body(id(1)) }));
      await contents.create(
        content(4, { featuredImageId: id(1), socialImageId: id(1), body: body(id(1)) }),
      );
      await contents.create(content(5, { featuredImageId: id(2) }));
      await contents.create(content(6, { featuredImageId: id(1), deletedAt: at(1) }));

      await expect(contents.countMediaUsage(id(1))).resolves.toBe(4);
      await expect(contents.countMediaUsage(id(2))).resolves.toBe(1);
    });

    it('follows edits', async () => {
      await contents.create(content(1, { featuredImageId: id(1) }));

      await contents.save(content(1, { version: 2, featuredImageId: id(2), body: aTextBody('x') }));

      await expect(contents.countMediaUsage(id(1))).resolves.toBe(0);
      await expect(contents.countMediaUsage(id(2))).resolves.toBe(1);
    });

    it('clears the reference when media is force-deleted, leaving the content', async () => {
      await contents.create(content(1, { featuredImageId: id(1), socialImageId: id(1) }));

      await repo.delete(id(1));

      await expect(contents.findById(contentId(1))).resolves.toMatchObject({
        featuredImageId: null,
        socialImageId: null,
      });
    });
  });

  it('stops a user who uploaded media being deleted', async () => {
    await repo.create(item(1));

    await expect(new PrismaUserRepository(db.context).delete(USER)).rejects.toThrow(UserInUseError);
  });
});
