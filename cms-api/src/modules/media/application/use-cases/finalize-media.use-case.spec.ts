import { beforeEach, describe, expect, it } from 'vitest';
import {
  JPEG_BYTES,
  PDF_BYTES,
  PNG_BYTES,
  aMediaItem,
} from '../../../../../test/builders/a-media-item.js';
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
import {
  FileTooLargeError,
  InvalidMediaError,
  MediaAlreadyExistsError,
  UnsupportedMediaTypeError,
  UploadChangedError,
  UploadNotFoundError,
} from '../../domain/errors/media.errors.js';
import type { MediaDeps } from '../media-deps.js';
import { FinalizeMedia } from './finalize-media.use-case.js';
import { PresignUpload } from './presign-upload.use-case.js';

const author: Actor = { id: 'author-1', role: 'author' };
const other: Actor = { id: 'author-2', role: 'author' };
const IP = '203.0.113.9';
const ID = '11111111-1111-4111-8111-111111111111';
const PENDING = `uploads/author-1/${ID}.png`;
const ORIGINAL = `media/${ID}/original.png`;
const MAX = 1000;

describe('uploading media', () => {
  let media: InMemoryMediaRepository;
  let storage: InMemoryObjectStorage;
  let audit: InMemoryAuditLog;
  let events: RecordingEventPublisher;
  let tx: FakeTransactionRunner;
  let deps: MediaDeps;

  beforeEach(() => {
    media = new InMemoryMediaRepository();
    storage = new InMemoryObjectStorage();
    audit = new InMemoryAuditLog();
    events = new RecordingEventPublisher();
    tx = new FakeTransactionRunner();
    deps = {
      media,
      storage,
      audit,
      events,
      tx,
      svg: new FakeSvgSanitizer(),
      images: new FakeImageProcessor(),
      variantQueue: new RecordingVariantQueue(),
      usage: new FakeMediaUsageReader(),
      clock: new FakeClock(),
      ids: new SequentialIdGenerator(),
      logger: new InMemoryLogger(),
      mediaConfig: { maxUploadBytes: MAX, uploadUrlTtlSeconds: 900, readUrlTtlSeconds: 3600 },
    };
  });

  describe('PresignUpload (FR-MEDIA-04)', () => {
    const presign = (overrides: Partial<Parameters<PresignUpload['execute']>[0]> = {}) =>
      new PresignUpload(deps).execute({
        actor: author,
        filename: 'Hero.PNG',
        mimeType: 'image/png',
        sizeBytes: 100,
        ...overrides,
      });

    it("signs an upload into the owner's pending area, fixing the type and size", async () => {
      const result = await presign();

      expect(result.storageKey).toMatch(/^uploads\/author-1\/[0-9a-f-]{36}\.png$/);
      expect(result).toMatchObject({
        uploadUrl: `https://storage.test/upload/${result.storageKey}`,
        expiresInSeconds: 900,
        headers: { 'Content-Type': 'image/png' },
      });
      expect(storage.uploadRequests[0]).toEqual({
        key: result.storageKey,
        contentType: 'image/png',
        contentLength: 100,
        expiresInSeconds: 900,
      });
    });

    it('refuses a type outside the allow-list', async () => {
      await expect(
        presign({ filename: 'a.exe', mimeType: 'application/x-msdownload' }),
      ).rejects.toThrow(UnsupportedMediaTypeError);
    });

    it('refuses an extension that does not match the type', async () => {
      await expect(presign({ filename: 'a.pdf' })).rejects.toThrow(UnsupportedMediaTypeError);
    });

    it('accepts exactly the limit and refuses more (FR-MEDIA-02)', async () => {
      await expect(presign({ sizeBytes: MAX })).resolves.toBeDefined();
      await expect(presign({ sizeBytes: MAX + 1 })).rejects.toThrow(FileTooLargeError);
    });

    it.each([0, -1, 1.5])('refuses a size of %s', async (sizeBytes) => {
      await expect(presign({ sizeBytes })).rejects.toThrow(InvalidMediaError);
    });

    it('refuses a bad filename', async () => {
      await expect(presign({ filename: '.png' })).rejects.toThrow(InvalidMediaError);
    });
  });

  describe('FinalizeMedia (FR-MEDIA-03, SEC-05)', () => {
    const finalize = (overrides: Partial<Parameters<FinalizeMedia['execute']>[0]> = {}) =>
      new FinalizeMedia(deps).execute({
        actor: author,
        ip: IP,
        storageKey: PENDING,
        filename: 'hero.png',
        mimeType: 'image/png',
        ...overrides,
      });
    const refused = () => {
      expect(storage.objects.has(PENDING)).toBe(false);
      expect(media.items.size).toBe(0);
      expect(audit.actions()).toEqual(['media.upload_rejected']);
    };

    beforeEach(() => {
      storage.upload(PENDING, PNG_BYTES, 'image/png');
    });

    it('moves the checked file out of the upload area and records it', async () => {
      const view = await finalize({ altText: 'A hero', caption: 'Cap' });

      expect(storage.objects.has(PENDING)).toBe(false);
      expect(storage.objects.has(ORIGINAL)).toBe(true);
      expect(media.get(ID)).toMatchObject({
        id: ID,
        storageKey: ORIGINAL,
        filename: 'hero.png',
        mimeType: 'image/png',
        sizeBytes: PNG_BYTES.length,
        altText: 'A hero',
        caption: 'Cap',
        variantStatus: 'pending',
        uploadedBy: author.id,
      });
      expect(view).toMatchObject({
        id: ID,
        url: `https://storage.test/${ORIGINAL}?d=inline&ttl=3600`,
        variants: {},
        uploaderName: null,
      });
      expect(tx.runs).toBe(1);
    });

    it('audits the upload and announces it after the commit', async () => {
      await finalize();

      expect(audit.events[0]).toMatchObject({
        actorId: author.id,
        actorIp: IP,
        action: 'media.upload',
        targetType: 'media',
        targetId: ID,
        summary: { filename: 'hero.png', mime_type: 'image/png', size_bytes: PNG_BYTES.length },
      });
      expect(events.published).toEqual([
        { type: 'MediaUploaded', mediaId: ID, needsVariants: true },
      ]);
    });

    it('asks for no variants for a PDF, and serves it as a download', async () => {
      const key = `uploads/author-1/${ID}.pdf`;
      storage.upload(key, PDF_BYTES, 'application/pdf');

      const view = await finalize({
        storageKey: key,
        filename: 'faq.pdf',
        mimeType: 'application/pdf',
      });

      expect(view.variantStatus).toBe('none');
      expect(view.url).toContain('d=attachment');
      expect(events.published).toEqual([
        { type: 'MediaUploaded', mediaId: ID, needsVariants: false },
      ]);
    });

    it('accepts either extension of a type', async () => {
      const key = `uploads/author-1/${ID}.jpeg`;
      storage.upload(key, JPEG_BYTES, 'image/jpeg');

      await expect(
        finalize({ storageKey: key, filename: 'a.jpeg', mimeType: 'image/jpeg' }),
      ).resolves.toMatchObject({ mimeType: 'image/jpeg' });
    });

    describe('who may finalize', () => {
      it("refuses another user's upload and leaves it alone", async () => {
        await expect(finalize({ actor: other })).rejects.toThrow(ForbiddenError);

        expect(storage.objects.has(PENDING)).toBe(true);
        expect(audit.events).toEqual([]);
      });

      it('refuses a key outside the upload area', async () => {
        await expect(finalize({ storageKey: ORIGINAL })).rejects.toThrow(InvalidMediaError);
      });

      it('reports an upload that is not there', async () => {
        await expect(
          finalize({
            storageKey: `uploads/author-1/${'2'.repeat(8)}-1111-4111-8111-111111111111.png`,
          }),
        ).rejects.toThrow(UploadNotFoundError);
      });

      it('refuses a bad filename before touching anything', async () => {
        await expect(finalize({ filename: '' })).rejects.toThrow(InvalidMediaError);
        expect(storage.objects.has(PENDING)).toBe(true);
      });
    });

    describe('mismatches: each is refused, removed and audited', () => {
      it('a declared type outside the allow-list', async () => {
        await expect(finalize({ mimeType: 'text/html', filename: 'a.html' })).rejects.toThrow(
          UnsupportedMediaTypeError,
        );
        refused();
        expect(audit.events[0]).toMatchObject({
          actorId: author.id,
          actorIp: IP,
          targetType: 'media',
          targetId: ID,
          summary: { filename: 'a.html', code: 'UNSUPPORTED_MEDIA_TYPE' },
        });
      });

      it('an extension that does not match the declared type', async () => {
        await expect(finalize({ filename: 'hero.jpg' })).rejects.toThrow(UnsupportedMediaTypeError);
        refused();
      });

      it('a real JPEG whose name disagrees with the extension it was uploaded under', async () => {
        storage.upload(PENDING, JPEG_BYTES, 'image/jpeg');

        await expect(finalize({ filename: 'hero.jpg', mimeType: 'image/jpeg' })).rejects.toThrow(
          UnsupportedMediaTypeError,
        );
        refused();
      });

      it('a real PNG declared with an extension of another type', async () => {
        const key = `uploads/author-1/${ID}.jpg`;
        storage.upload(key, PNG_BYTES, 'image/png');

        await expect(finalize({ storageKey: key, filename: 'hero.jpg' })).rejects.toThrow(
          UnsupportedMediaTypeError,
        );
        expect(storage.objects.has(key)).toBe(false);
      });

      it('an extension that differs from the one uploaded', async () => {
        await expect(finalize({ filename: 'hero.jpg', mimeType: 'image/jpeg' })).rejects.toThrow(
          UnsupportedMediaTypeError,
        );
        refused();
      });

      it('a stored type that differs from the declared one', async () => {
        storage.upload(PENDING, PNG_BYTES, 'text/html');

        await expect(finalize()).rejects.toThrow(UnsupportedMediaTypeError);
        refused();
      });

      it('bytes that are not what the type claims', async () => {
        storage.upload(PENDING, Buffer.from('<html><script>alert(1)</script></html>'), 'image/png');

        await expect(finalize()).rejects.toThrow(UnsupportedMediaTypeError);
        refused();
      });

      it('bytes of another allowed type', async () => {
        storage.upload(PENDING, JPEG_BYTES, 'image/png');

        await expect(finalize()).rejects.toThrow(UnsupportedMediaTypeError);
        refused();
      });

      it('nothing at exactly the limit', async () => {
        const padding = Buffer.alloc(MAX - PNG_BYTES.length);
        storage.upload(PENDING, Buffer.concat([PNG_BYTES, padding]), 'image/png');

        await expect(finalize()).resolves.toBeDefined();
      });

      it('a file over the limit, even though the URL said otherwise', async () => {
        storage.upload(PENDING, Buffer.concat([PNG_BYTES, Buffer.alloc(MAX)]), 'image/png');

        await expect(finalize()).rejects.toThrow(FileTooLargeError);
        refused();
      });
    });

    it('reads only the start of a file to check it, and only that version', async () => {
      const requests: unknown[] = [];
      const read = storage.read.bind(storage);
      storage.read = (key, request) => {
        requests.push(request);
        return read(key, request);
      };

      await finalize();

      expect(requests).toEqual([{ etag: expect.any(String) as string, maxBytes: 4096 }]);
    });

    describe('a file swapped after it was checked', () => {
      it('is refused if it changes before the content is read', async () => {
        const read = storage.read.bind(storage);
        storage.read = (key, request) => read(key, { ...request, etag: 'something-else' });

        await expect(finalize()).rejects.toThrow(UploadChangedError);
        refused();
      });

      it('is refused if it changes before it is moved', async () => {
        storage.replaceBeforeCopy = true;

        await expect(finalize()).rejects.toThrow(UploadChangedError);
        refused();
        expect(storage.objects.has(ORIGINAL)).toBe(false);
      });
    });

    describe('SVG', () => {
      const KEY = `uploads/author-1/${ID}.svg`;
      const finalizeSvg = () =>
        finalize({ storageKey: KEY, filename: 'logo.svg', mimeType: 'image/svg+xml' });
      const svg = (body: string) => Buffer.from(`<svg xmlns="x">${body}</svg>`);

      it('stores the sanitized file, and records its new size', async () => {
        const dirty = svg('<script>alert(1)</script><rect/>');
        storage.upload(KEY, dirty, 'image/svg+xml');

        const view = await finalizeSvg();

        const stored = storage.objects.get(`media/${ID}/original.svg`);
        expect(Buffer.from(stored?.bytes ?? []).toString()).toBe('<svg xmlns="x"><rect/></svg>');
        expect(stored?.contentType).toBe('image/svg+xml');
        expect(view.sizeBytes).toBe(stored?.bytes.length);
        expect(storage.objects.has(KEY)).toBe(false);
      });

      it('refuses one that is not well-formed', async () => {
        storage.upload(KEY, svg('not-well-formed'), 'image/svg+xml');

        await expect(finalizeSvg()).rejects.toThrow(UnsupportedMediaTypeError);
        expect(storage.objects.has(KEY)).toBe(false);
      });

      it('refuses one too large to sanitize', async () => {
        deps = {
          ...deps,
          mediaConfig: { ...deps.mediaConfig, maxUploadBytes: 20_000_000 },
        };
        storage.upload(
          KEY,
          Buffer.concat([svg(''), Buffer.alloc(5 * 1024 * 1024)]),
          'image/svg+xml',
        );

        await expect(finalizeSvg()).rejects.toThrow(FileTooLargeError);
      });

      it('accepts one at the sanitizing limit', async () => {
        deps = {
          ...deps,
          mediaConfig: { ...deps.mediaConfig, maxUploadBytes: 20_000_000 },
        };
        const start = svg('');
        storage.upload(
          KEY,
          Buffer.concat([start, Buffer.alloc(5 * 1024 * 1024 - start.length)]),
          'image/svg+xml',
        );

        await expect(finalizeSvg()).resolves.toBeDefined();
      });

      it('is refused if it changes before the whole file is read', async () => {
        storage.upload(KEY, svg(''), 'image/svg+xml');
        const read = storage.read.bind(storage);
        let reads = 0;
        storage.read = (key, request) => {
          reads += 1;
          return reads === 1 ? read(key, request) : Promise.resolve(null);
        };

        await expect(finalizeSvg()).rejects.toThrow(UploadChangedError);
      });
    });

    describe('when recording fails', () => {
      it('removes the stored file, so nothing is left without a record', async () => {
        media.create = () => Promise.reject(new Error('database went away'));

        await expect(finalize()).rejects.toThrow('database went away');

        expect(storage.objects.has(ORIGINAL)).toBe(false);
        expect(events.published).toEqual([]);
      });

      it('leaves the file alone when another request finalized this upload first', async () => {
        media.add(aMediaItem({ id: ID, storageKey: ORIGINAL }));

        await expect(finalize()).rejects.toThrow(MediaAlreadyExistsError);

        expect(storage.objects.has(ORIGINAL)).toBe(true);
      });

      it('does not treat a storage outage as a bad file', async () => {
        storage.read = () => Promise.reject(new Error('storage went away'));

        await expect(finalize()).rejects.toThrow('storage went away');

        expect(storage.objects.has(PENDING)).toBe(true);
        expect(audit.events).toEqual([]);
      });
    });
  });
});
