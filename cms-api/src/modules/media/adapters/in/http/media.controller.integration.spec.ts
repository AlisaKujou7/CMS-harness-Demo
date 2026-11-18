import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aContent } from '../../../../../../test/builders/a-content.js';
import { aMediaItem, MEDIA_ID, PNG_BYTES } from '../../../../../../test/builders/a-media-item.js';
import { anAccount } from '../../../../../../test/builders/auth-context.js';
import {
  createFakeInfrastructure,
  createTestApp,
  http,
  type FakeInfrastructure,
} from '../../../../../../test/builders/http-app.js';
import type { UserRole } from '../../../../../shared/kernel/actor.js';

const MEDIA = '/api/admin/media';
const actorId = (role: UserRole) => `actor-${role}`;

describe('media endpoints', () => {
  let infra: FakeInfrastructure;
  let app: INestApplication;

  const bearer = async (role: UserRole, id = actorId(role)) => {
    infra.accounts.add(anAccount({ id, email: `${id}@example.com`, role }));
    return `Bearer ${await infra.signer.sign({ userId: id, role }, 900)}`;
  };

  beforeEach(async () => {
    infra = createFakeInfrastructure();
    app = await createTestApp(infra);
  });

  afterEach(() => app.close());

  describe('authentication', () => {
    it.each([
      ['POST', `${MEDIA}/presign`],
      ['POST', MEDIA],
      ['GET', MEDIA],
      ['GET', `${MEDIA}/${MEDIA_ID}`],
      ['PATCH', `${MEDIA}/${MEDIA_ID}`],
      ['DELETE', `${MEDIA}/${MEDIA_ID}`],
    ])('%s %s returns 401 without a token', async (method, path) => {
      const client = http(app);
      const request =
        method === 'GET'
          ? client.get(path)
          : method === 'POST'
            ? client.post(path)
            : method === 'PATCH'
              ? client.patch(path)
              : client.delete(path);

      await request.expect(401);
    });
  });

  describe('the upload flow (FR-MEDIA-04)', () => {
    const presign = async (authorization: string, body: object) =>
      http(app).post(`${MEDIA}/presign`).set('Authorization', authorization).send(body);

    it('presigns, accepts the uploaded file, and queues its variants', async () => {
      const authorization = await bearer('author');

      const presigned = await presign(authorization, {
        filename: 'hero.png',
        mime_type: 'image/png',
        size_bytes: PNG_BYTES.length,
      });
      expect(presigned.status).toBe(200);
      const {
        storage_key: key,
        upload_url: url,
        headers,
        expires_in: expiresIn,
      } = (
        presigned.body as {
          data: {
            storage_key: string;
            upload_url: string;
            headers: object;
            expires_in: number;
          };
        }
      ).data;
      expect(url).toContain(key);
      expect(headers).toEqual({ 'Content-Type': 'image/png' });
      expect(expiresIn).toBe(900);

      infra.storage.upload(key, PNG_BYTES, 'image/png');
      const finalized = await http(app)
        .post(MEDIA)
        .set('Authorization', authorization)
        .send({
          storage_key: key,
          filename: 'hero.png',
          mime_type: 'image/png',
          alt_text: 'A hero',
          caption: null,
        })
        .expect(201);

      const media = (finalized.body as { data: { id: string } }).data;
      expect(media).toMatchObject({
        filename: 'hero.png',
        mime_type: 'image/png',
        size_bytes: PNG_BYTES.length,
        alt_text: 'A hero',
        caption: null,
        variant_status: 'pending',
        uploaded_by: actorId('author'),
      });
      expect(infra.variantQueue.enqueued).toEqual([media.id]);
    });

    it('queues nothing for a PDF', async () => {
      const authorization = await bearer('author');
      const key = `uploads/${actorId('author')}/${MEDIA_ID}.pdf`;
      infra.storage.upload(key, Buffer.from('%PDF-1.7'), 'application/pdf');

      await http(app)
        .post(MEDIA)
        .set('Authorization', authorization)
        .send({ storage_key: key, filename: 'a.pdf', mime_type: 'application/pdf' })
        .expect(201);

      expect(infra.variantQueue.enqueued).toEqual([]);
    });

    it('returns 422 for a file whose content is not what it claims', async () => {
      const authorization = await bearer('author');
      const key = `uploads/${actorId('author')}/${MEDIA_ID}.png`;
      infra.storage.upload(key, Buffer.from('<html></html>'), 'image/png');

      const res = await http(app)
        .post(MEDIA)
        .set('Authorization', authorization)
        .send({ storage_key: key, filename: 'a.png', mime_type: 'image/png' })
        .expect(422);

      expect((res.body as { error: { code: string } }).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it("returns 403 for another user's upload", async () => {
      const key = `uploads/someone-else/${MEDIA_ID}.png`;
      infra.storage.upload(key, PNG_BYTES, 'image/png');

      await http(app)
        .post(MEDIA)
        .set('Authorization', await bearer('admin'))
        .send({ storage_key: key, filename: 'a.png', mime_type: 'image/png' })
        .expect(403);
    });

    it.each([
      ['no filename', { mime_type: 'image/png', size_bytes: 1 }],
      ['no type', { filename: 'a.png', size_bytes: 1 }],
      ['a size as text', { filename: 'a.png', mime_type: 'image/png', size_bytes: '1' }],
    ])('refuses a presign with %s', async (_name, body) => {
      const res = await presign(await bearer('author'), body);

      expect(res.status).toBe(422);
    });

    it('refuses a file over the limit before any upload', async () => {
      const res = await presign(await bearer('author'), {
        filename: 'a.png',
        mime_type: 'image/png',
        size_bytes: 20 * 1024 * 1024 + 1,
      });

      expect(res.status).toBe(422);
      expect((res.body as { error: { code: string } }).error.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('GET', () => {
    beforeEach(() => {
      infra.media.add(aMediaItem({ altText: 'Alt', uploadedBy: 'someone' }));
    });

    it('lets any signed-in role browse the library, with signed URLs', async () => {
      const res = await http(app)
        .get(MEDIA)
        .query({ search: 'hero', kind: 'image', page: 1, page_size: 5 })
        .set('Authorization', await bearer('author'))
        .expect(200);

      expect(res.body).toMatchObject({
        data: [
          {
            id: MEDIA_ID,
            alt_text: 'Alt',
            uploader_name: 'Name of someone',
            url: expect.stringContaining('https://storage.test/') as string,
          },
        ],
        pagination: { page: 1, page_size: 5, total: 1, total_pages: 1 },
      });
    });

    it.each([
      [{ uploaded_by: 'not-a-uuid' }],
      [{ kind: 'video' }],
      [{ from: 'yesterday' }],
      [{ to: 'tomorrow' }],
      [{ search: 'a\0b' }],
    ])('refuses the filter %j', async (query) => {
      await http(app)
        .get(MEDIA)
        .query(query)
        .set('Authorization', await bearer('editor'))
        .expect(422);
    });

    it('shows how much content uses an item', async () => {
      infra.contents.add(aContent({ featuredImageId: MEDIA_ID }));

      const res = await http(app)
        .get(`${MEDIA}/${MEDIA_ID}`)
        .set('Authorization', await bearer('author'))
        .expect(200);

      expect((res.body as { data: object }).data).toMatchObject({ id: MEDIA_ID, usage_count: 1 });
    });

    it('returns 404 and 422 as appropriate', async () => {
      const authorization = await bearer('author');

      await http(app)
        .get(`${MEDIA}/66666666-6666-4666-8666-666666666666`)
        .set('Authorization', authorization)
        .expect(404);
      await http(app).get(`${MEDIA}/nope`).set('Authorization', authorization).expect(422);
    });
  });

  describe('PATCH', () => {
    it('updates metadata for its uploader', async () => {
      infra.media.add(aMediaItem({ uploadedBy: actorId('author') }));

      const res = await http(app)
        .patch(`${MEDIA}/${MEDIA_ID}`)
        .set('Authorization', await bearer('author'))
        .send({ alt_text: 'New', caption: 'Cap' })
        .expect(200);

      expect((res.body as { data: object }).data).toMatchObject({
        alt_text: 'New',
        caption: 'Cap',
      });
    });

    it('forbids another Author', async () => {
      infra.media.add(aMediaItem({ uploadedBy: 'someone' }));

      await http(app)
        .patch(`${MEDIA}/${MEDIA_ID}`)
        .set('Authorization', await bearer('author'))
        .send({ alt_text: 'New' })
        .expect(403);
    });
  });

  describe('DELETE (FR-MEDIA-07)', () => {
    const remove = async (role: UserRole, query = '') =>
      http(app)
        .delete(`${MEDIA}/${MEDIA_ID}${query}`)
        .set('Authorization', await bearer(role));

    it('deletes unreferenced media with 204', async () => {
      infra.media.add(aMediaItem());

      expect((await remove('editor')).status).toBe(204);
      expect(infra.media.items.size).toBe(0);
    });

    it('returns 409 explaining why when published content uses it', async () => {
      infra.media.add(aMediaItem());
      infra.contents.add(aContent({ status: 'published', socialImageId: MEDIA_ID }));

      const res = await remove('editor');

      expect(res.status).toBe(409);
      expect((res.body as { error: object }).error).toMatchObject({
        code: 'MEDIA_IN_USE',
        details: { usage_count: 1 },
      });
    });

    it('counts images inside the body too', async () => {
      infra.media.add(aMediaItem());
      infra.contents.add(
        aContent({
          body: {
            type: 'doc',
            content: [{ type: 'image', attrs: { src: '/x.png', mediaId: MEDIA_ID } }],
          },
        }),
      );

      expect((await remove('editor')).status).toBe(409);
    });

    it('does not count soft-deleted content', async () => {
      infra.media.add(aMediaItem());
      infra.contents.add(aContent({ featuredImageId: MEDIA_ID, deletedAt: new Date() }));

      expect((await remove('editor')).status).toBe(204);
    });

    it('lets only an Admin force it', async () => {
      infra.media.add(aMediaItem());
      infra.contents.add(aContent({ featuredImageId: MEDIA_ID }));

      expect((await remove('editor', '?force=true')).status).toBe(403);
      expect((await remove('admin', '?force=true')).status).toBe(204);
    });

    it('refuses a nonsense force value', async () => {
      expect((await remove('admin', '?force=yes')).status).toBe(422);
    });

    it('keeps an Author to their own', async () => {
      infra.media.add(aMediaItem({ uploadedBy: 'someone' }));

      expect((await remove('author')).status).toBe(403);
    });
  });
});
