import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aContent, aTextBody } from '../../../../../../test/builders/a-content.js';
import { anAccount } from '../../../../../../test/builders/auth-context.js';
import {
  createFakeInfrastructure,
  createTestApp,
  http,
  type FakeInfrastructure,
} from '../../../../../../test/builders/http-app.js';
import type { UserRole } from '../../../../../shared/kernel/actor.js';

const CONTENT = '/api/admin/content';
const ID = '22222222-2222-4222-8222-222222222222';
const MISSING = '33333333-3333-4333-8333-333333333333';
const actorId = (role: UserRole) => `actor-${role}`;

interface Item {
  readonly id: string;
  readonly [field: string]: unknown;
}

describe('content endpoints', () => {
  let infra: FakeInfrastructure;
  let app: INestApplication;

  const bearer = async (role: UserRole, id = actorId(role)) => {
    infra.accounts.add(anAccount({ id, email: `${id}@example.com`, role }));
    return `Bearer ${await infra.signer.sign({ userId: id, role }, 900)}`;
  };
  const store = (overrides: Parameters<typeof aContent>[0] = {}) => {
    infra.contents.add(aContent({ id: ID, authorId: actorId('author'), ...overrides }));
  };

  beforeEach(async () => {
    infra = createFakeInfrastructure();
    app = await createTestApp(infra);
  });

  afterEach(() => app.close());

  describe('authorization matrix (02-SRS 5.3.1, FR-AUTHZ-01)', () => {
    type Call = readonly ['GET' | 'POST' | 'PATCH' | 'DELETE', string, object?];
    const every: readonly Call[] = [
      ['GET', CONTENT],
      ['POST', CONTENT, { type: 'article', title: 'T' }],
      ['GET', `${CONTENT}/stats`],
      ['GET', `${CONTENT}/categories`],
      ['GET', `${CONTENT}/${ID}`],
      ['PATCH', `${CONTENT}/${ID}`, { version: 1 }],
      ['POST', `${CONTENT}/${ID}/submit`],
      ['GET', `${CONTENT}/${ID}/versions`],
      ['GET', `${CONTENT}/${ID}/versions/1`],
      ['POST', `${CONTENT}/${ID}/revert/1`],
    ];
    const moderation: readonly Call[] = [
      ['POST', `${CONTENT}/${ID}/publish`],
      ['POST', `${CONTENT}/${ID}/reject`, { note: 'n' }],
      ['POST', `${CONTENT}/${ID}/unpublish`],
      ['POST', `${CONTENT}/${ID}/archive`],
      ['POST', `${CONTENT}/${ID}/schedule`, { scheduled_at: null }],
      ['DELETE', `${CONTENT}/${ID}`],
    ];
    const cases = (calls: readonly Call[]) => calls.map((c) => [c[0], c[1], c] as const);
    const send = (call: Call) => {
      const [method, path, body] = call;
      const client = http(app);
      if (method === 'GET') return client.get(path);
      if (method === 'DELETE') return client.delete(path);
      return (method === 'POST' ? client.post(path) : client.patch(path)).send(body);
    };

    it.each(cases([...every, ...moderation]))(
      '%s %s returns 401 without a token',
      async (_method, _path, call) => {
        await send(call).expect(401);
      },
    );

    it.each(cases(moderation))(
      '%s %s returns 403 for an Author, even on their own content',
      async (_method, _path, call) => {
        store();

        await send(call)
          .set('Authorization', await bearer('author'))
          .expect(403);
      },
    );

    it.each(cases(moderation))(
      '%s %s reaches the use case for an Editor (FR-AUTHZ-03)',
      async (_method, _path, call) => {
        const res = await send(call).set('Authorization', await bearer('editor'));

        expect(res.status).toBe(404);
      },
    );

    it.each(cases(moderation))(
      '%s %s reaches the use case for an Admin (FR-AUTHZ-04)',
      async (_method, _path, call) => {
        const res = await send(call).set('Authorization', await bearer('admin'));

        expect(res.status).toBe(404);
      },
    );

    it('rejects a malformed id before doing any work', async () => {
      await http(app)
        .get(`${CONTENT}/not-a-uuid`)
        .set('Authorization', await bearer('editor'))
        .expect(422);
    });
  });

  describe('POST /content', () => {
    it('creates a draft and returns it in the response shape', async () => {
      const res = await http(app)
        .post(CONTENT)
        .set('Authorization', await bearer('author'))
        .send({
          type: 'article',
          title: 'Hello World',
          body: aTextBody('Text'),
          seo_title: 'SEO',
          tags: ['one'],
        })
        .expect(201);

      expect((res.body as { data: Item }).data).toMatchObject({
        type: 'article',
        title: 'Hello World',
        slug: 'hello-world',
        status: 'draft',
        seo_title: 'SEO',
        effective_seo: { title: 'SEO', description: 'Text' },
        tags: ['one'],
        author_id: actorId('author'),
        version: 1,
      });
    });

    it('stores a script-bearing body sanitized (SEC-04)', async () => {
      const res = await http(app)
        .post(CONTENT)
        .set('Authorization', await bearer('author'))
        .send({ type: 'article', title: 'T', body: aTextBody('<script>alert(1)</script>safe') })
        .expect(201);

      expect(JSON.stringify(res.body)).not.toContain('<script');
      expect(JSON.stringify(res.body)).not.toContain('alert');
    });

    it('accepts a long article, beyond the default body limit', async () => {
      await http(app)
        .post(CONTENT)
        .set('Authorization', await bearer('author'))
        .send({ type: 'article', title: 'Long', body: aTextBody('x'.repeat(1_000_000)) })
        .expect(201);
    });

    it('keeps the small default limit on other routes', async () => {
      await http(app)
        .post('/api/admin/auth/login')
        .send({ email: 'a@example.com', password: 'x'.repeat(200_000) })
        .expect(413);
    });

    it('answers a body over the limit with 413, not a server error', async () => {
      const res = await http(app)
        .post(CONTENT)
        .set('Authorization', await bearer('author'))
        .send({ type: 'article', title: 'Huge', body: aTextBody('x'.repeat(3_000_000)) });

      expect(res.status).toBe(413);
    });

    it.each([
      ['no title', { type: 'article' }],
      ['an unknown type', { type: 'video', title: 'T' }],
      ['a malformed image id', { type: 'article', title: 'T', featured_image_id: 'x' }],
    ])('refuses %s', async (_name, body) => {
      await http(app)
        .post(CONTENT)
        .set('Authorization', await bearer('author'))
        .send(body)
        .expect(422);
    });

    it('returns 409 for a slug already taken', async () => {
      store({ slug: 'taken' });

      const res = await http(app)
        .post(CONTENT)
        .set('Authorization', await bearer('editor'))
        .send({ type: 'article', title: 'T', slug: 'taken' })
        .expect(409);

      expect((res.body as { error: { code: string } }).error.code).toBe('SLUG_TAKEN');
    });
  });

  describe('PATCH /content/:id', () => {
    it('applies only what was sent', async () => {
      store({ title: 'Old', seoTitle: 'Kept', version: 2 });

      const res = await http(app)
        .patch(`${CONTENT}/${ID}`)
        .set('Authorization', await bearer('author'))
        .send({ version: 2, title: 'New', seo_description: 'Desc' })
        .expect(200);

      expect((res.body as { data: Item }).data).toMatchObject({
        title: 'New',
        seo_title: 'Kept',
        seo_description: 'Desc',
        version: 3,
      });
    });

    it('returns 409 CONTENT_CHANGED for a stale version', async () => {
      store({ version: 5 });

      const res = await http(app)
        .patch(`${CONTENT}/${ID}`)
        .set('Authorization', await bearer('author'))
        .send({ version: 4, title: 'New' })
        .expect(409);

      expect((res.body as { error: { code: string } }).error.code).toBe('CONTENT_CHANGED');
    });

    it('requires the version', async () => {
      store();

      await http(app)
        .patch(`${CONTENT}/${ID}`)
        .set('Authorization', await bearer('author'))
        .send({ title: 'New' })
        .expect(422);
    });

    it("returns 403 on another author's content", async () => {
      store();

      await http(app)
        .patch(`${CONTENT}/${ID}`)
        .set('Authorization', await bearer('author', 'someone-else'))
        .send({ version: 1, title: 'New' })
        .expect(403);
    });
  });

  describe('lifecycle (FR-CONTENT-04)', () => {
    it('walks from draft through review to published, unpublished and archived', async () => {
      store({ body: aTextBody('Text') });
      const author = await bearer('author');
      const editor = await bearer('editor');
      const step = async (action: string, authorization: string, status: string) => {
        const res = await http(app)
          .post(`${CONTENT}/${ID}/${action}`)
          .set('Authorization', authorization)
          .expect(200);
        expect((res.body as { data: Item }).data['status']).toBe(status);
      };

      await step('submit', author, 'in_review');
      await step('publish', editor, 'published');
      await step('unpublish', editor, 'unpublished');
      await step('archive', editor, 'archived');
    });

    it('returns 409 for a wrong transition, for any role', async () => {
      store({ status: 'archived' });

      await http(app)
        .post(`${CONTENT}/${ID}/publish`)
        .set('Authorization', await bearer('admin'))
        .expect(409);
    });

    it('returns 422 listing what a publish is missing', async () => {
      store();

      const res = await http(app)
        .post(`${CONTENT}/${ID}/publish`)
        .set('Authorization', await bearer('editor'))
        .expect(422);

      expect((res.body as { error: { details: unknown } }).error.details).toEqual({
        fields: ['body', 'seoDescription'],
      });
    });

    it('rejects with a note, and without one', async () => {
      store({ status: 'in_review' });
      const editor = await bearer('editor');

      const res = await http(app)
        .post(`${CONTENT}/${ID}/reject`)
        .set('Authorization', editor)
        .send({ note: 'Add a source' })
        .expect(200);
      expect((res.body as { data: Item }).data['review_note']).toBe('Add a source');

      store({ status: 'in_review', version: 9 });
      await http(app).post(`${CONTENT}/${ID}/reject`).set('Authorization', editor).expect(200);
    });

    it('schedules and cancels', async () => {
      store({ body: aTextBody('Text') });
      const editor = await bearer('editor');
      const at = new Date(infra.clock.now().getTime() + 60_000).toISOString();

      const res = await http(app)
        .post(`${CONTENT}/${ID}/schedule`)
        .set('Authorization', editor)
        .send({ scheduled_at: at })
        .expect(200);
      expect((res.body as { data: Item }).data['scheduled_at']).toBe(at);

      const cancelled = await http(app)
        .post(`${CONTENT}/${ID}/schedule`)
        .set('Authorization', editor)
        .send({ scheduled_at: null })
        .expect(200);
      expect((cancelled.body as { data: Item }).data['scheduled_at']).toBeNull();
    });

    it('refuses a malformed time, and a missing one', async () => {
      store({ body: aTextBody('Text') });
      const editor = await bearer('editor');

      for (const body of [{ scheduled_at: 'soon' }, {}]) {
        await http(app)
          .post(`${CONTENT}/${ID}/schedule`)
          .set('Authorization', editor)
          .send(body)
          .expect(422);
      }
    });

    it('soft deletes with 204, after which the item is gone', async () => {
      store();
      const editor = await bearer('editor');

      await http(app).delete(`${CONTENT}/${ID}`).set('Authorization', editor).expect(204);
      await http(app).get(`${CONTENT}/${ID}`).set('Authorization', editor).expect(404);
    });

    it('restores a deleted item, and forbids Authors from doing so', async () => {
      store();
      const editor = await bearer('editor');
      await http(app).delete(`${CONTENT}/${ID}`).set('Authorization', editor).expect(204);

      const author = await bearer('author');
      await http(app).post(`${CONTENT}/${ID}/restore`).set('Authorization', author).expect(403);
      const restored = await http(app)
        .post(`${CONTENT}/${ID}/restore`)
        .set('Authorization', editor)
        .expect(200);

      expect(restored.body).toMatchObject({ data: { id: ID } });
      await http(app).get(`${CONTENT}/${ID}`).set('Authorization', editor).expect(200);
    });

    it('undoes an unpublish for an Editor, and forbids Authors from doing so', async () => {
      store({ status: 'unpublished', body: aTextBody('Text'), updatedAt: infra.clock.now() });
      const author = await bearer('author');
      const editor = await bearer('editor');
      const undo = `${CONTENT}/${ID}/unpublish/undo`;

      await http(app).post(undo).set('Authorization', author).expect(403);
      const res = await http(app).post(undo).set('Authorization', editor).expect(200);

      expect(res.body).toMatchObject({ data: { status: 'published' } });
      await http(app).post(undo).set('Authorization', editor).expect(409);
    });

    it('answers 404 when restoring an item that is not deleted', async () => {
      store();
      const editor = await bearer('editor');

      await http(app).post(`${CONTENT}/${ID}/restore`).set('Authorization', editor).expect(404);
    });
  });

  describe('GET /content', () => {
    beforeEach(() => {
      const mine = actorId('author');
      infra.contents.add(aContent({ id: 'a', slug: 'a', title: 'Apple', authorId: mine }));
      infra.contents.add(
        aContent({ id: 'b', slug: 'b', title: 'Banana', authorId: 'other', tags: ['fruit'] }),
      );
      infra.contents.add(
        aContent({ id: 'c', slug: 'c', title: 'Old', authorId: mine, status: 'archived' }),
      );
    });

    const ids = (res: { body: unknown }) =>
      (res.body as { data: Item[] }).data.map((item) => item.id).sort();
    const get = async (role: UserRole, query: object = {}) =>
      http(app)
        .get(CONTENT)
        .query(query)
        .set('Authorization', await bearer(role))
        .expect(200);

    it('shows an Author only their own, regardless of query (FR-AUTHZ-02)', async () => {
      const author = await get('author', { author_id: MISSING });

      expect(ids(author)).toEqual(['a']);
    });

    it('returns the list envelope with the author name and no body', async () => {
      const res = await get('editor', { page: 1, page_size: 1, sort: 'title' });

      expect(res.body).toMatchObject({
        data: [{ id: 'a', title: 'Apple', author_name: `Name of ${actorId('author')}` }],
        pagination: { page: 1, page_size: 1, total: 2, total_pages: 2 },
      });
      expect((res.body as { data: Item[] }).data[0]).not.toHaveProperty('body');
    });

    it.each([
      ['status', { status: 'archived' }, ['c']],
      ['type', { type: 'page' }, []],
      ['tag', { tag: 'fruit' }, ['b']],
      ['tag, whatever its case', { tag: ' FRUIT ' }, ['b']],
      ['search, case-insensitively', { search: 'APP' }, ['a']],
      ['a date range', { from: '2000-01-01T00:00:00Z', to: '2000-01-02T00:00:00Z' }, []],
    ])('filters by %s (FR-CONTENT-10)', async (_name, query, expected) => {
      expect(ids(await get('editor', query))).toEqual(expected);
    });

    it('sorts in the order asked for', async () => {
      const titles = (res: { body: unknown }) =>
        (res.body as { data: Item[] }).data.map((item) => item['title']);

      expect(titles(await get('editor', { sort: 'title' }))).toEqual(['Apple', 'Banana']);
      expect(titles(await get('editor', { sort: '-title' }))).toEqual(['Banana', 'Apple']);
    });

    it.each([
      ['an unknown status', { status: 'lost' }],
      ['an unknown sort', { sort: 'password' }],
      ['a malformed date', { from: 'yesterday' }],
      ['a NUL in the search', { search: 'a\0b' }],
    ])('refuses %s', async (_name, query) => {
      await http(app)
        .get(CONTENT)
        .query(query)
        .set('Authorization', await bearer('editor'))
        .expect(422);
    });
  });

  describe('dashboard and form data', () => {
    it('returns counts scoped to the actor', async () => {
      store();

      const mine = await http(app)
        .get(`${CONTENT}/stats`)
        .set('Authorization', await bearer('author'))
        .expect(200);
      const other = await http(app)
        .get(`${CONTENT}/stats`)
        .set('Authorization', await bearer('author', 'someone-else'))
        .expect(200);

      expect((mine.body as { data: { draft: number } }).data.draft).toBe(1);
      expect((other.body as { data: { draft: number } }).data.draft).toBe(0);
    });

    it('returns the predefined categories', async () => {
      const res = await http(app)
        .get(`${CONTENT}/categories`)
        .set('Authorization', await bearer('author'))
        .expect(200);

      expect(res.body).toEqual({ data: ['news', 'guides'] });
    });
  });

  describe('versions', () => {
    const edit = async (authorization: string, title: string, version: number) =>
      http(app)
        .patch(`${CONTENT}/${ID}`)
        .set('Authorization', authorization)
        .send({ title, version })
        .expect(200);

    it('lists, reads and reverts (FR-CONTENT-08, 09)', async () => {
      store({ title: 'One' });
      const author = await bearer('author');
      await edit(author, 'Two', 1);
      await edit(author, 'Three', 2);

      const list = await http(app)
        .get(`${CONTENT}/${ID}/versions`)
        .set('Authorization', author)
        .expect(200);
      expect(list.body).toMatchObject({
        data: [
          { version_no: 3, editor_id: actorId('author'), editor_name: 'An Editor' },
          { version_no: 2, editor_id: actorId('author'), editor_name: 'An Editor' },
        ],
        pagination: { total: 2 },
      });

      const version = await http(app)
        .get(`${CONTENT}/${ID}/versions/2`)
        .set('Authorization', author)
        .expect(200);
      expect(version.body).toMatchObject({
        data: { version_no: 2, snapshot: { title: 'Two', slug: 'a-title', status: 'draft' } },
      });

      const reverted = await http(app)
        .post(`${CONTENT}/${ID}/revert/2`)
        .set('Authorization', author)
        .expect(200);
      expect(reverted.body).toMatchObject({ data: { title: 'Two', version: 4 } });
    });

    it.each(['0', '-1', 'abc', '99999999999'])('refuses version %s', async (version) => {
      await http(app)
        .get(`${CONTENT}/${ID}/versions/${version}`)
        .set('Authorization', await bearer('editor'))
        .expect(422);
    });
  });
});
