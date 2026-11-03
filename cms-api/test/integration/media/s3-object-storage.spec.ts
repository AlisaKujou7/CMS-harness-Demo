import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import {
  S3ObjectStorage,
  type S3StorageConfig,
} from '../../../src/modules/media/adapters/out/storage/s3-object-storage.js';
import { createTestBucket, STORAGE_KEY, STORAGE_SECRET } from '../support/test-bucket.js';

const CREDENTIALS = { accessKey: STORAGE_KEY, secretKey: STORAGE_SECRET };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

describe('S3ObjectStorage against a real S3 service', () => {
  let storage: S3ObjectStorage;
  let config: S3StorageConfig;
  const key = (name: string) => `${randomUUID()}/${name}`;

  beforeAll(async () => {
    const { endpoint, bucket } = await createTestBucket();
    config = { bucket, endpoint, region: 'us-east-1', forcePathStyle: true, ...CREDENTIALS };
    storage = new S3ObjectStorage(config);
  });

  const presign = (target: string, contentLength = PNG.length) =>
    storage.uploadUrl({
      key: target,
      contentType: 'image/png',
      contentLength,
      expiresInSeconds: 60,
    });
  const upload = async (url: string, body: Uint8Array, contentType = 'image/png') =>
    fetch(url, {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'Content-Type': contentType },
    });

  describe('presigned uploads (FR-MEDIA-04)', () => {
    it('accept a file with the declared type and size', async () => {
      const target = key('a.png');

      const res = await upload(await presign(target), PNG);

      expect(res.status).toBe(200);
      await expect(storage.head(target)).resolves.toMatchObject({
        size: PNG.length,
        contentType: 'image/png',
      });
    });

    it('refuse a different type', async () => {
      const res = await upload(await presign(key('a.png')), PNG, 'text/html');

      expect(res.status).toBe(403);
    });

    it('refuse a different size', async () => {
      const res = await upload(await presign(key('a.png')), Buffer.concat([PNG, PNG]));

      expect(res.status).toBe(403);
    });

    it('refuse once expired', async () => {
      const url = await storage.uploadUrl({
        key: key('a.png'),
        contentType: 'image/png',
        contentLength: PNG.length,
        expiresInSeconds: 1,
      });
      await new Promise((resolve) => setTimeout(resolve, 2100));

      expect((await upload(url, PNG)).status).toBe(403);
    });
  });

  describe('signed reads (SEC-06)', () => {
    it('serve the file, with the requested disposition and an encoded name', async () => {
      const target = key('a.png');
      await storage.put(target, PNG, 'image/png');

      const res = await fetch(
        await storage.readUrl({
          key: target,
          filename: 'สวัสดี "x".png',
          attachment: true,
          expiresInSeconds: 60,
        }),
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toBe(
        `attachment; filename*=UTF-8''${encodeURIComponent('สวัสดี "x".png')}`,
      );
      expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
    });

    it('open images inline', async () => {
      const target = key('a.png');
      await storage.put(target, PNG, 'image/png');

      const res = await fetch(
        await storage.readUrl({
          key: target,
          filename: 'a.png',
          attachment: false,
          expiresInSeconds: 60,
        }),
      );

      expect(res.headers.get('content-disposition')).toContain('inline');
    });

    it('are the only way in: the bucket refuses anonymous reads and listing', async () => {
      const target = key('a.png');
      await storage.put(target, PNG, 'image/png');
      const signed = new URL(
        await storage.readUrl({
          key: target,
          filename: 'a.png',
          attachment: false,
          expiresInSeconds: 60,
        }),
      );
      const bucketUrl = `${signed.origin}/${signed.pathname.split('/')[1] ?? ''}`;

      expect((await fetch(`${signed.origin}${signed.pathname}`)).status).toBe(403);
      expect((await fetch(`${bucketUrl}?list-type=2`)).status).toBe(403);
    });

    it('sign for the public host when one is set', async () => {
      const publicStorage = new S3ObjectStorage({
        bucket: 'b',
        endpoint: inject('minioUrl'),
        publicUrl: 'https://media.example.com',
        region: 'us-east-1',
        forcePathStyle: true,
        ...CREDENTIALS,
      });

      const url = await publicStorage.readUrl({
        key: 'k',
        filename: 'f',
        attachment: false,
        expiresInSeconds: 60,
      });

      expect(new URL(url).host).toBe('media.example.com');
    });
  });

  describe('when storage refuses the request', () => {
    const refused = () => new S3ObjectStorage({ ...config, secretKey: 'wrong' });

    it('fails loudly, rather than reporting a file as missing or changed', async () => {
      await expect(refused().head('k')).rejects.toThrow();
      await expect(refused().read('k', { maxBytes: 4 })).rejects.toThrow();
      await expect(refused().copyIfUnchanged('a', 'b', '"x"')).rejects.toThrow();
    });
  });

  it('head reports a missing object as null', async () => {
    await expect(storage.head(key('none'))).resolves.toBeNull();
  });

  describe('read', () => {
    it('returns the whole file, or only the start', async () => {
      const target = key('a');
      await storage.put(target, PNG, 'image/png');

      await expect(storage.read(target, { maxBytes: 100 })).resolves.toEqual(new Uint8Array(PNG));
      await expect(storage.read(target, { maxBytes: 4 })).resolves.toEqual(
        new Uint8Array(PNG.subarray(0, 4)),
      );
    });

    it('returns null when missing', async () => {
      await expect(storage.read(key('none'), { maxBytes: 4 })).resolves.toBeNull();
    });

    it('returns an empty result for an empty file', async () => {
      const target = key('empty');
      await storage.put(target, Buffer.alloc(0), 'image/png');

      await expect(storage.read(target, { maxBytes: 4 })).resolves.toHaveLength(0);
    });

    it('returns null when the version has changed', async () => {
      const target = key('a');
      await storage.put(target, PNG, 'image/png');
      const { etag } = (await storage.head(target)) as { etag: string };

      await expect(storage.read(target, { etag, maxBytes: 4 })).resolves.toHaveLength(4);

      await storage.put(target, Buffer.from('changed'), 'image/png');
      await expect(storage.read(target, { etag, maxBytes: 4 })).resolves.toBeNull();
    });
  });

  describe('copyIfUnchanged', () => {
    it('copies the bytes and the type', async () => {
      const from = key('a b.png');
      const to = key('c.png');
      await storage.put(from, PNG, 'image/png');
      const { etag } = (await storage.head(from)) as { etag: string };

      await expect(storage.copyIfUnchanged(from, to, etag)).resolves.toBe(true);

      await expect(storage.head(to)).resolves.toMatchObject({
        size: PNG.length,
        contentType: 'image/png',
      });
    });

    it('refuses when the file was swapped after it was checked', async () => {
      const from = key('a.png');
      const to = key('c.png');
      await storage.put(from, PNG, 'image/png');
      const { etag } = (await storage.head(from)) as { etag: string };
      await storage.put(from, Buffer.from('<html>'), 'image/png');

      await expect(storage.copyIfUnchanged(from, to, etag)).resolves.toBe(false);

      await expect(storage.head(to)).resolves.toBeNull();
    });

    it('refuses when the source is gone', async () => {
      await expect(storage.copyIfUnchanged(key('none'), key('c'), '"x"')).resolves.toBe(false);
    });
  });

  describe('delete', () => {
    it('removes several objects, ignores missing ones, and accepts none', async () => {
      const a = key('a');
      const b = key('b');
      await storage.put(a, PNG, 'image/png');
      await storage.put(b, PNG, 'image/png');

      await storage.delete([a, b, key('none')]);
      await storage.delete([]);

      await expect(storage.head(a)).resolves.toBeNull();
      await expect(storage.head(b)).resolves.toBeNull();
    });
  });

  describe('deleteOlderThan', () => {
    it('removes only what is older, under the prefix', async () => {
      const prefix = `${randomUUID()}/`;
      const inside = `${prefix}a`;
      const outside = key('a');
      await storage.put(inside, PNG, 'image/png');
      await storage.put(outside, PNG, 'image/png');

      await expect(storage.deleteOlderThan(prefix, new Date(Date.now() - 60_000))).resolves.toBe(0);
      await expect(storage.deleteOlderThan(prefix, new Date(Date.now() + 60_000))).resolves.toBe(1);

      await expect(storage.head(inside)).resolves.toBeNull();
      await expect(storage.head(outside)).resolves.not.toBeNull();
    });

    it('finds nothing to do under an empty prefix', async () => {
      await expect(storage.deleteOlderThan(`${randomUUID()}/`, new Date())).resolves.toBe(0);
    });

    it('works through more than one page', async () => {
      const paged = new S3ObjectStorage({ ...config, listPageSize: 2 });
      const prefix = `${randomUUID()}/`;
      for (let n = 0; n < 5; n += 1) {
        await paged.put(`${prefix}${String(n)}`, Buffer.from('x'), 'text/plain');
      }

      await expect(paged.deleteOlderThan(prefix, new Date(Date.now() + 60_000))).resolves.toBe(5);
    });
  });
});
