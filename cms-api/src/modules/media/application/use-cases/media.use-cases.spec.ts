import { beforeEach, describe, expect, it } from 'vitest';
import { aMediaItem, MEDIA_ID } from '../../../../../test/builders/a-media-item.js';
import {
  FakeImageProcessor,
  FakeMediaUsageReader,
  FakeSvgSanitizer,
  InMemoryMediaRepository,
  InMemoryObjectStorage,
  RecordingVariantQueue,
} from '../../../../../test/fakes/media.fakes.js';
import {
  FakeClock,
  FakeTransactionRunner,
  InMemoryAuditLog,
  InMemoryLogger,
  RecordingEventPublisher,
  SequentialIdGenerator,
} from '../../../../../test/fakes/system.fakes.js';
import type { Actor } from '../../../../shared/kernel/actor.js';
import { ForbiddenError } from '../../../../shared/kernel/app-error.js';
import { MediaInUseError, MediaNotFoundError } from '../../domain/errors/media.errors.js';
import type { MediaDeps } from '../media-deps.js';
import { DeleteMedia, UpdateMedia } from './manage-media.use-case.js';
import {
  EnqueueMissingVariants,
  GenerateMediaVariants,
  PurgeAbandonedUploads,
  PurgeDeletedMediaFiles,
} from './media-background.use-case.js';
import {
  GetMedia,
  GetMediaViews,
  InspectImageReferences,
  ListMedia,
} from './read-media.use-case.js';

const admin: Actor = { id: 'admin-1', role: 'admin' };
const editor: Actor = { id: 'editor-1', role: 'editor' };
const author: Actor = { id: 'author-1', role: 'author' };
const otherAuthor: Actor = { id: 'author-2', role: 'author' };
const IP = '203.0.113.9';

describe('media use cases', () => {
  let media: InMemoryMediaRepository;
  let storage: InMemoryObjectStorage;
  let audit: InMemoryAuditLog;
  let events: RecordingEventPublisher;
  let usage: FakeMediaUsageReader;
  let images: FakeImageProcessor;
  let queue: RecordingVariantQueue;
  let logger: InMemoryLogger;
  let clock: FakeClock;
  let deps: MediaDeps;

  beforeEach(() => {
    media = new InMemoryMediaRepository();
    storage = new InMemoryObjectStorage();
    audit = new InMemoryAuditLog();
    events = new RecordingEventPublisher();
    usage = new FakeMediaUsageReader();
    images = new FakeImageProcessor();
    queue = new RecordingVariantQueue();
    logger = new InMemoryLogger();
    clock = new FakeClock('2026-06-01T00:00:00Z');
    deps = {
      media,
      storage,
      audit,
      events,
      usage,
      images,
      logger,
      clock,
      variantQueue: queue,
      svg: new FakeSvgSanitizer(),
      tx: new FakeTransactionRunner(),
      ids: new SequentialIdGenerator(),
      mediaConfig: { maxUploadBytes: 1000, uploadUrlTtlSeconds: 900, readUrlTtlSeconds: 3600 },
    };
  });

  describe('UpdateMedia (FR-MEDIA-06)', () => {
    const update = (actor: Actor, changes: object) =>
      new UpdateMedia(deps).execute({ actor, id: MEDIA_ID, ip: IP, ...changes });

    it('changes what was sent and audits which fields', async () => {
      media.add(aMediaItem({ altText: 'Old', caption: 'Kept' }));

      const view = await update(author, { altText: 'New' });

      expect(view).toMatchObject({ altText: 'New', caption: 'Kept' });
      expect(media.get(MEDIA_ID).altText).toBe('New');
      expect(audit.events[0]).toMatchObject({
        actorId: author.id,
        actorIp: IP,
        action: 'media.update',
        targetType: 'media',
        targetId: MEDIA_ID,
        summary: { fields: ['altText'] },
      });
    });

    it('clears a field with null', async () => {
      media.add(aMediaItem({ caption: 'Cap' }));

      await expect(update(author, { caption: null })).resolves.toMatchObject({ caption: null });
      expect(audit.events[0]?.summary).toEqual({ fields: ['caption'] });
    });

    it('records nothing when nothing changed', async () => {
      media.add(aMediaItem({ altText: 'Same' }));

      await update(author, { altText: 'Same' });

      expect(audit.events).toEqual([]);
    });

    it("lets an Editor or Admin change anyone's, and an Author only their own", async () => {
      media.add(aMediaItem());

      await expect(update(editor, { altText: 'E' })).resolves.toBeDefined();
      await expect(update(admin, { altText: 'A' })).resolves.toBeDefined();
      await expect(update(otherAuthor, { altText: 'O' })).rejects.toThrow(ForbiddenError);
    });

    it('reports media that is not there', async () => {
      await expect(update(editor, {})).rejects.toThrow(MediaNotFoundError);
    });
  });

  describe('DeleteMedia (FR-MEDIA-07)', () => {
    const remove = (actor: Actor, force = false) =>
      new DeleteMedia(deps).execute({ actor, id: MEDIA_ID, ip: IP, force });
    const withStoredFiles = () => {
      const variants = { thumbnail: { key: 'thumb', width: 1, height: 1 } };
      media.add(aMediaItem({ storageKey: 'orig', variants }));
      storage.upload('orig', Buffer.from('a'), 'image/png');
      storage.upload('thumb', Buffer.from('b'), 'image/webp');
    };

    it('removes the record and every stored file, and audits it', async () => {
      withStoredFiles();

      await remove(author);

      expect(media.items.size).toBe(0);
      expect(storage.objects.size).toBe(0);
      expect(audit.events[0]).toMatchObject({
        actorId: author.id,
        actorIp: IP,
        action: 'media.delete',
        targetType: 'media',
        targetId: MEDIA_ID,
        summary: { filename: 'hero.png', forced: false, usage_count: 0 },
      });
      expect(events.published).toEqual([{ type: 'MediaDeleted', mediaId: MEDIA_ID }]);
    });

    it('returns 409 while content uses it, with how many', async () => {
      withStoredFiles();
      usage.usage.set(MEDIA_ID, 3);

      await expect(remove(editor)).rejects.toThrow(MediaInUseError);
      await expect(remove(editor)).rejects.toMatchObject({ details: { usage_count: 3 } });

      expect(media.items.size).toBe(1);
      expect(storage.objects.size).toBe(2);
    });

    it('lets an Admin force it, on record', async () => {
      withStoredFiles();
      usage.usage.set(MEDIA_ID, 3);

      await remove(admin, true);

      expect(media.items.size).toBe(0);
      expect(audit.events[0]?.summary).toMatchObject({ forced: true, usage_count: 3 });
    });

    it.each([editor, author])('forbids $role from forcing', async (actor) => {
      withStoredFiles();

      await expect(remove(actor, true)).rejects.toThrow(ForbiddenError);
      expect(media.items.size).toBe(1);
    });

    it("lets an Editor delete anyone's, and an Author only their own", async () => {
      withStoredFiles();
      await expect(remove(otherAuthor)).rejects.toThrow(ForbiddenError);

      await expect(remove(editor)).resolves.toBeUndefined();
    });

    it('reports success when the record is gone but storage is down, and owes the deletion', async () => {
      withStoredFiles();
      storage.delete = () => Promise.reject(new Error('storage went away'));

      await expect(remove(editor)).resolves.toBeUndefined();

      expect(media.items.size).toBe(0);
      expect([...media.pendingFileDeletions]).toEqual(['orig', 'thumb']);
      expect(events.published).toEqual([{ type: 'MediaDeleted', mediaId: MEDIA_ID }]);
      expect(logger.errors[0]).toMatchObject({
        message: 'Could not delete media files yet',
        context: { error: 'storage went away' },
      });
    });

    it('owes nothing once the files are gone', async () => {
      withStoredFiles();

      await remove(editor);

      expect(media.pendingFileDeletions.size).toBe(0);
    });

    it('keeps the files when the transaction fails', async () => {
      withStoredFiles();
      audit.record = () => Promise.reject(new Error('audit is down'));

      await expect(remove(editor)).rejects.toThrow('audit is down');

      expect(storage.objects.size).toBe(2);
      expect(events.published).toEqual([]);
    });

    it('reports media that is not there', async () => {
      await expect(remove(editor)).rejects.toThrow(MediaNotFoundError);
    });
  });

  describe('GetMedia', () => {
    it('gives the details drawer its uploader, usage and signed URLs', async () => {
      const variants = { thumbnail: { key: 'thumb', width: 320, height: 160 } };
      media.add(aMediaItem({ variants, variantStatus: 'ready', width: 640, height: 320 }));
      usage.usage.set(MEDIA_ID, 2);

      const view = await new GetMedia(deps).execute({ id: MEDIA_ID });

      expect(view).toMatchObject({
        id: MEDIA_ID,
        uploaderName: 'Name of author-1',
        usageCount: 2,
        width: 640,
        height: 320,
        variantStatus: 'ready',
        variants: {
          thumbnail: {
            url: 'https://storage.test/thumb?d=inline&ttl=3600',
            width: 320,
            height: 160,
          },
        },
      });
    });

    it('reports media that is not there', async () => {
      await expect(new GetMedia(deps).execute({ id: MEDIA_ID })).rejects.toThrow(
        MediaNotFoundError,
      );
    });
  });

  describe('ListMedia (FR-MEDIA-08)', () => {
    const list = (filters: object = {}) => new ListMedia(deps).execute(filters);
    const names = async (filters: object) =>
      (await list(filters)).items.map((item) => item.filename);

    beforeEach(() => {
      media.add(
        aMediaItem({
          id: 'a',
          filename: 'hero.png',
          altText: 'Sunset',
          createdAt: new Date('2026-01-01'),
        }),
      );
      media.add(
        aMediaItem({
          id: 'b',
          filename: 'faq.pdf',
          mimeType: 'application/pdf',
          uploadedBy: 'author-2',
          createdAt: new Date('2026-02-01'),
        }),
      );
    });

    it('lists newest first with uploader names and URLs', async () => {
      const result = await list();

      expect(result.total).toBe(2);
      expect(result.items[0]).toMatchObject({
        filename: 'faq.pdf',
        uploaderName: 'Name of author-2',
      });
      expect(result.items[0]?.url).toContain('d=attachment');
    });

    it('filters', async () => {
      await expect(names({ search: 'HERO' })).resolves.toEqual(['hero.png']);
      await expect(names({ search: 'sunset' })).resolves.toEqual(['hero.png']);
      await expect(names({ uploadedBy: 'author-2' })).resolves.toEqual(['faq.pdf']);
      await expect(names({ kind: 'image' })).resolves.toEqual(['hero.png']);
      await expect(names({ kind: 'document' })).resolves.toEqual(['faq.pdf']);
      await expect(names({ from: new Date('2026-01-15') })).resolves.toEqual(['faq.pdf']);
      await expect(names({ to: new Date('2026-01-15') })).resolves.toEqual(['hero.png']);
    });

    it('pages', async () => {
      await expect(list({ page: 2, pageSize: 1 })).resolves.toMatchObject({
        page: 2,
        pageSize: 1,
        totalPages: 2,
      });
    });
  });

  it('GetMediaViews returns signed views of what exists', async () => {
    media.add(aMediaItem());

    const views = await new GetMediaViews(deps).execute([MEDIA_ID, 'gone']);

    expect(views.map((view) => view.id)).toEqual([MEDIA_ID]);
    expect(views[0]?.url).toContain('https://storage.test/');
  });

  describe('InspectImageReferences', () => {
    const inspect = (ids: readonly string[]) => new InspectImageReferences(deps).execute(ids);

    it('sorts ids into missing and not images, whatever their case', async () => {
      const upper = 'ABCDEF00-0000-4000-8000-000000000000';
      media.add(aMediaItem());
      media.add(aMediaItem({ id: upper.toLowerCase() }));
      media.add(aMediaItem({ id: 'doc', mimeType: 'application/pdf' }));

      await expect(inspect([MEDIA_ID, upper, 'doc', 'gone'])).resolves.toEqual({
        missing: ['gone'],
        notImages: ['doc'],
      });
    });

    it('asks nothing when given nothing', async () => {
      media.findMimeTypes = () => Promise.reject(new Error('should not be called'));

      await expect(inspect([])).resolves.toEqual({ missing: [], notImages: [] });
    });
  });

  describe('GenerateMediaVariants (FR-MEDIA-05)', () => {
    const generate = () => new GenerateMediaVariants(deps).execute(MEDIA_ID);

    beforeEach(() => {
      storage.upload(`media/${MEDIA_ID}/original.png`, Buffer.from('image'), 'image/png');
    });

    it('stores both variants and records them with the dimensions', async () => {
      media.add(aMediaItem());

      await generate();

      expect(media.get(MEDIA_ID)).toMatchObject({
        width: 2000,
        height: 1000,
        variantStatus: 'ready',
        variants: {
          thumbnail: { key: `media/${MEDIA_ID}/thumbnail.webp`, width: 320, height: 160 },
          medium: { key: `media/${MEDIA_ID}/medium.webp`, width: 1024, height: 512 },
        },
      });
      expect(storage.objects.get(`media/${MEDIA_ID}/thumbnail.webp`)?.contentType).toBe(
        'image/webp',
      );
    });

    it.each(['ready', 'failed', 'none'] as const)('does nothing for status %s', async (status) => {
      media.add(aMediaItem({ variantStatus: status }));

      await generate();

      expect(storage.objects.has(`media/${MEDIA_ID}/thumbnail.webp`)).toBe(false);
      expect(media.get(MEDIA_ID).variantStatus).toBe(status);
    });

    it('does nothing for media that was deleted', async () => {
      await expect(generate()).resolves.toBeUndefined();
    });

    it('marks a file no processor can read as failed, since a retry would not help', async () => {
      media.add(aMediaItem());
      images.result = null;

      await generate();

      expect(media.get(MEDIA_ID)).toMatchObject({ variantStatus: 'failed', variants: {} });
      expect(logger.errors[0]).toMatchObject({
        message: 'Could not create media variants',
        context: { mediaId: MEDIA_ID },
      });
    });

    it('marks media whose file is gone as failed, since a retry would not help', async () => {
      media.add(aMediaItem({ storageKey: 'nowhere' }));

      await generate();

      expect(media.get(MEDIA_ID).variantStatus).toBe('failed');
    });

    it('fails the job during a storage outage, so the queue retries', async () => {
      media.add(aMediaItem());
      storage.read = () => Promise.reject(new Error('storage went away'));

      await expect(generate()).rejects.toThrow('storage went away');
      expect(media.get(MEDIA_ID).variantStatus).toBe('pending');
    });

    it('removes what it stored if the media was deleted meanwhile', async () => {
      media.add(aMediaItem());
      media.saveVariants = () => Promise.resolve(false);

      await generate();

      expect(storage.objects.has(`media/${MEDIA_ID}/thumbnail.webp`)).toBe(false);
      expect(storage.objects.has(`media/${MEDIA_ID}/medium.webp`)).toBe(false);
    });
  });

  describe('EnqueueMissingVariants', () => {
    it('asks again for what has waited too long, leaving fresh uploads to the queue', async () => {
      const now = clock.now().getTime();
      media.add(aMediaItem({ id: 'old', createdAt: new Date(now - 3 * 60_000) }));
      media.add(aMediaItem({ id: 'new', createdAt: new Date(now - 60_000) }));
      media.add(
        aMediaItem({ id: 'done', variantStatus: 'ready', createdAt: new Date(now - 3 * 60_000) }),
      );

      await expect(new EnqueueMissingVariants(deps).execute()).resolves.toBe(1);

      expect(queue.enqueued).toEqual(['old']);
    });

    it('gives up on what has waited a day, so it cannot starve newer items', async () => {
      const now = clock.now().getTime();
      media.add(aMediaItem({ id: 'stale', createdAt: new Date(now - 25 * 3_600_000) }));
      media.add(aMediaItem({ id: 'waiting', createdAt: new Date(now - 23 * 3_600_000) }));

      await expect(new EnqueueMissingVariants(deps).execute()).resolves.toBe(1);

      expect(media.get('stale').variantStatus).toBe('failed');
      expect(queue.enqueued).toEqual(['waiting']);
      expect(logger.errors[0]).toMatchObject({
        message: 'Gave up waiting for media variants',
        context: { count: 1 },
      });
    });

    it('logs nothing when nothing was given up on', async () => {
      await new EnqueueMissingVariants(deps).execute();

      expect(logger.errors).toEqual([]);
    });

    it('takes a bounded number per run', async () => {
      const createdAt = new Date(clock.now().getTime() - 3 * 60_000);
      for (let n = 0; n < 101; n += 1) media.add(aMediaItem({ id: `m${String(n)}`, createdAt }));

      await expect(new EnqueueMissingVariants(deps).execute()).resolves.toBe(100);
    });
  });

  describe('PurgeDeletedMediaFiles', () => {
    const run = () => new PurgeDeletedMediaFiles(deps).execute();

    it('finishes what storage could not do at the time', async () => {
      storage.upload('a', Buffer.from('x'), 'image/png');
      media.pendingFileDeletions.add('a');

      await expect(run()).resolves.toBe(1);

      expect(storage.objects.size).toBe(0);
      expect(media.pendingFileDeletions.size).toBe(0);
    });

    it('keeps them owed while storage is still down', async () => {
      media.pendingFileDeletions.add('a');
      storage.delete = () => Promise.reject(new Error('storage went away'));

      await expect(run()).rejects.toThrow('storage went away');

      expect(media.pendingFileDeletions.has('a')).toBe(true);
    });

    it('works in bounded batches', async () => {
      for (let n = 0; n < 501; n += 1) media.pendingFileDeletions.add(String(n));

      await expect(run()).resolves.toBe(500);
    });

    it('does nothing when nothing is owed', async () => {
      storage.delete = () => Promise.reject(new Error('should not be called'));

      await expect(run()).resolves.toBe(0);
    });
  });

  describe('PurgeAbandonedUploads (RK-03)', () => {
    it('removes only uploads older than a day', async () => {
      const now = clock.now().getTime();
      storage.now = new Date(now - 25 * 3_600_000);
      storage.upload('uploads/a/old.png', Buffer.from('a'), 'image/png');
      storage.upload('media/a/old.png', Buffer.from('a'), 'image/png');
      storage.now = new Date(now - 23 * 3_600_000);
      storage.upload('uploads/a/new.png', Buffer.from('a'), 'image/png');

      await expect(new PurgeAbandonedUploads(deps).execute()).resolves.toBe(1);

      expect([...storage.objects.keys()].sort()).toEqual(['media/a/old.png', 'uploads/a/new.png']);
    });
  });
});
