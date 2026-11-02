import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { aContent, aTextBody, T0, after } from '../../../../test/builders/a-content.js';
import { Content } from './entities/content.entity.js';
import {
  ConcurrentModificationError,
  ContentNotFoundError,
  InvalidContentError,
  InvalidScheduleError,
  InvalidSlugError,
  InvalidTransitionError,
  MissingRequiredFieldsError,
  SlugConflictError,
} from './errors/content.errors.js';
import { assertPublishable } from './services/publish-requirements-checker.js';
import { EMPTY_DOCUMENT, hasContent, plainText } from './services/rich-text.js';
import { Slug } from './value-objects/slug.vo.js';

const publishable = (overrides = {}) => aContent({ body: aTextBody('Hello world'), ...overrides });
const fieldOf = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return (error as InvalidContentError).details?.['field'];
  }
  return undefined;
};

describe('Slug', () => {
  it.each([
    ['hello-world', 'hello-world'],
    ['MY-TITLE', 'my-title'],
    ['  spaced  ', 'spaced'],
    ['a1-b2', 'a1-b2'],
  ])('normalizes "%s" to "%s"', (input, expected) => {
    expect(Slug.create(input).value).toBe(expected);
  });

  it.each(['', '  ', 'foo--bar', '-foo', 'foo-', 'has space', 'ไทย', 'a/b', 'a'.repeat(201)])(
    'rejects "%s"',
    (input) => {
      expect(() => Slug.create(input)).toThrow(InvalidSlugError);
    },
  );

  it('accepts exactly 200 characters', () => {
    expect(Slug.create('a'.repeat(200)).value).toHaveLength(200);
  });

  it('accepts any well-formed slug unchanged', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9]{1,20}(-[a-z0-9]{1,20}){0,5}$/), (input) => {
        expect(Slug.create(input).value).toBe(input);
      }),
    );
  });

  describe('fromTitle (FR-CONTENT-02)', () => {
    it.each([
      ['My First Article!', 'my-first-article'],
      ['  Q2: Report & Plans  ', 'q2-report-plans'],
      ['Crème Brûlée', 'creme-brulee'],
      ['a---b', 'a-b'],
    ])('turns "%s" into "%s"', (title, expected) => {
      expect(Slug.fromTitle(title, 'fallback').value).toBe(expected);
    });

    it('uses the fallback when a title has no Latin letters or digits', () => {
      expect(Slug.fromTitle('บทความภาษาไทย', 'content-abc').value).toBe('content-abc');
    });

    it('never ends in a hyphen after cutting a long title', () => {
      const slug = Slug.fromTitle(`${'a'.repeat(179)} ${'b'.repeat(30)}`, 'x').value;

      expect(slug).toHaveLength(179);
      expect(slug.endsWith('-')).toBe(false);
    });

    it('always produces a valid slug', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 300 }), (title) => {
          expect(() => Slug.create(Slug.fromTitle(title, 'fallback').value)).not.toThrow();
        }),
      );
    });
  });
});

describe('rich text helpers', () => {
  it('joins text across blocks with spaces', () => {
    const body = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'One' }] },
        { type: 'heading', content: [{ type: 'text', text: 'Two' }] },
      ],
    };

    expect(plainText(body)).toBe('One Two');
  });

  it('keeps inline text together and collapses whitespace', () => {
    const body = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bo' },
            { type: 'text', text: 'ld  word' },
          ],
        },
      ],
    };

    expect(plainText(body)).toBe('Bold word');
  });

  it('treats a document with only whitespace as empty', () => {
    expect(hasContent(aTextBody('   '))).toBe(false);
    expect(hasContent(EMPTY_DOCUMENT)).toBe(false);
  });

  it('treats text as content', () => {
    expect(hasContent(aTextBody('x'))).toBe(true);
  });

  it('treats an image with no text as content', () => {
    expect(
      hasContent({ type: 'doc', content: [{ type: 'image', attrs: { src: '/a.png' } }] }),
    ).toBe(true);
  });

  it('finds an image nested inside a block', () => {
    const body = {
      type: 'doc',
      content: [{ type: 'blockquote', content: [{ type: 'image', attrs: { src: '/a.png' } }] }],
    };

    expect(hasContent(body)).toBe(true);
  });
});

describe('assertPublishable (FR-CONTENT-06)', () => {
  it('accepts a body with a description derived from it', () => {
    expect(() => {
      assertPublishable(publishable());
    }).not.toThrow();
  });

  it('rejects an empty body and lists what is missing', () => {
    try {
      assertPublishable(aContent());
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MissingRequiredFieldsError);
      expect((error as MissingRequiredFieldsError).details).toEqual({
        fields: ['body', 'seoDescription'],
      });
    }
  });

  it('accepts an image-only body when a description is given', () => {
    const body = { type: 'doc', content: [{ type: 'image', attrs: { src: '/a.png' } }] };

    expect(() => {
      assertPublishable(aContent({ body, seoDescription: 'A picture' }));
    }).not.toThrow();
  });

  it('rejects an image-only body with no description', () => {
    const body = { type: 'doc', content: [{ type: 'image', attrs: { src: '/a.png' } }] };

    try {
      assertPublishable(aContent({ body }));
      expect.unreachable();
    } catch (error) {
      expect((error as MissingRequiredFieldsError).details).toEqual({
        fields: ['seoDescription'],
      });
    }
  });
});

describe('Content.create (FR-CONTENT-01, 05)', () => {
  const create = (overrides = {}) =>
    Content.create({
      id: 'c1',
      type: 'article',
      authorId: 'u1',
      slug: 'hello',
      now: T0,
      fields: { title: 'Hello', ...overrides },
    });

  it('saves as a draft with only a title', () => {
    const content = create();

    expect(content).toMatchObject({
      id: 'c1',
      type: 'article',
      authorId: 'u1',
      slug: 'hello',
      title: 'Hello',
      status: 'draft',
      version: 1,
      tags: [],
      category: null,
      parentId: null,
      seoTitle: null,
      seoDescription: null,
      featuredImageId: null,
      socialImageId: null,
      scheduledAt: null,
      publishedAt: null,
      deletedAt: null,
      reviewNote: null,
    });
    expect(content.body).toEqual(EMPTY_DOCUMENT);
    expect(content.createdAt).toEqual(T0);
    expect(content.updatedAt).toEqual(T0);
  });

  it('trims the title', () => {
    expect(create({ title: '  Hi  ' }).title).toBe('Hi');
  });

  it('keeps the optional fields it is given', () => {
    const body = aTextBody('Text');

    expect(
      create({
        body,
        seoTitle: 'T',
        seoDescription: 'D',
        featuredImageId: 'm1',
        socialImageId: 'm2',
        category: 'news',
      }),
    ).toMatchObject({
      body,
      seoTitle: 'T',
      seoDescription: 'D',
      featuredImageId: 'm1',
      socialImageId: 'm2',
      category: 'news',
    });
  });

  it.each(['', '   ', 'x'.repeat(201)])('rejects the title "%s"', (title) => {
    expect(fieldOf(() => create({ title }))).toBe('title');
  });

  it('accepts a title of exactly 200 characters', () => {
    expect(create({ title: 'x'.repeat(200) }).title).toHaveLength(200);
  });

  it('accepts SEO fields at their limits and rejects one character more (FR-SEO-01)', () => {
    expect(
      create({ seoTitle: 'x'.repeat(70), seoDescription: 'y'.repeat(160) }).seoTitle,
    ).toHaveLength(70);
    expect(fieldOf(() => create({ seoTitle: 'x'.repeat(71) }))).toBe('seoTitle');
    expect(fieldOf(() => create({ seoDescription: 'y'.repeat(161) }))).toBe('seoDescription');
  });

  it('stores blank SEO overrides as absent, so the defaults apply', () => {
    expect(create({ seoTitle: '  ', seoDescription: '' })).toMatchObject({
      seoTitle: null,
      seoDescription: null,
    });
  });

  it('normalizes tags to lowercase without duplicates', () => {
    expect(create({ tags: [' News ', 'news', 'Q2'] }).tags).toEqual(['news', 'q2']);
  });

  it.each([[['']], [['   ']], [['x'.repeat(41)]]])('rejects the tags %j', (tags) => {
    expect(fieldOf(() => create({ tags }))).toBe('tags');
  });

  it('accepts a tag of exactly 40 characters and at most 50 tags', () => {
    expect(create({ tags: ['x'.repeat(40)] }).tags).toHaveLength(1);
    const many = Array.from({ length: 50 }, (_, i) => `t${String(i)}`);
    expect(create({ tags: many }).tags).toHaveLength(50);
    expect(fieldOf(() => create({ tags: [...many, 'extra'] }))).toBe('tags');
  });

  it('refuses a parent on an article', () => {
    expect(fieldOf(() => create({ parentId: 'p1' }))).toBe('parentId');
  });

  describe('for a page (02-SRS 6.2)', () => {
    const page = (overrides = {}) =>
      Content.create({
        id: 'c1',
        type: 'page',
        authorId: 'u1',
        slug: 'about',
        now: T0,
        fields: { title: 'About', ...overrides },
      });

    it('allows a parent', () => {
      expect(page({ parentId: 'p1' }).parentId).toBe('p1');
    });

    it('refuses tags', () => {
      expect(fieldOf(() => page({ tags: ['x'] }))).toBe('tags');
    });

    it('refuses a category', () => {
      expect(fieldOf(() => page({ category: 'news' }))).toBe('category');
    });

    it('accepts an empty tag list', () => {
      expect(page({ tags: [] }).tags).toEqual([]);
    });
  });
});

describe('Content lifecycle methods', () => {
  it('bumps the version and stamps the time on every change', () => {
    const next = aContent().submit(after(5));

    expect(next.version).toBe(2);
    expect(next.updatedAt).toEqual(after(5));
    expect(next.createdAt).toEqual(T0);
  });

  it('does not change the original', () => {
    const original = aContent();

    original.submit(after(5));

    expect(original.status).toBe('draft');
    expect(original.version).toBe(1);
  });

  describe('submit', () => {
    it('moves a draft to review and clears any earlier rejection note', () => {
      const next = aContent({ reviewNote: 'Fix it' }).submit(T0);

      expect(next.status).toBe('in_review');
      expect(next.reviewNote).toBeNull();
    });

    it('refuses anything but a draft', () => {
      expect(() => aContent({ status: 'published' }).submit(T0)).toThrow(InvalidTransitionError);
    });
  });

  describe('publish', () => {
    it('publishes and sets published_at on first publish', () => {
      const next = publishable({ status: 'in_review' }).publish(after(5));

      expect(next.status).toBe('published');
      expect(next.publishedAt).toEqual(after(5));
    });

    it('keeps the first published_at when published again (02-SRS 6.2)', () => {
      const next = publishable({ publishedAt: T0 }).publish(after(5));

      expect(next.publishedAt).toEqual(T0);
    });

    it('clears a pending schedule and a review note', () => {
      const next = publishable({ scheduledAt: after(9), reviewNote: 'x' }).publish(after(5));

      expect(next.scheduledAt).toBeNull();
      expect(next.reviewNote).toBeNull();
    });

    it('refuses content that does not meet the requirements', () => {
      expect(() => aContent().publish(T0)).toThrow(MissingRequiredFieldsError);
    });

    it('refuses an invalid transition before checking requirements', () => {
      expect(() => aContent({ status: 'archived' }).publish(T0)).toThrow(InvalidTransitionError);
    });
  });

  describe('reject', () => {
    it('returns to draft with the note and clears a schedule (E2E-03)', () => {
      const next = aContent({ status: 'in_review', scheduledAt: after(9) }).reject('Too short', T0);

      expect(next).toMatchObject({ status: 'draft', reviewNote: 'Too short', scheduledAt: null });
    });

    it('stores a blank note as no note', () => {
      expect(aContent({ status: 'in_review' }).reject('  ', T0).reviewNote).toBeNull();
    });

    it('refuses a note over 2000 characters and accepts exactly 2000', () => {
      const review = aContent({ status: 'in_review' });

      expect(review.reject('x'.repeat(2000), T0).reviewNote).toHaveLength(2000);
      expect(fieldOf(() => review.reject('x'.repeat(2001), T0))).toBe('note');
    });

    it('refuses anything not in review', () => {
      expect(() => aContent().reject('x', T0)).toThrow(InvalidTransitionError);
    });
  });

  describe('unpublish and archive', () => {
    it('unpublishes and keeps published_at', () => {
      const next = aContent({ status: 'published', publishedAt: T0 }).unpublish(after(1));

      expect(next).toMatchObject({ status: 'unpublished', publishedAt: T0 });
    });

    it('refuses to unpublish a draft', () => {
      expect(() => aContent().unpublish(T0)).toThrow(InvalidTransitionError);
    });

    it('archives unpublished content', () => {
      expect(aContent({ status: 'unpublished' }).archive(T0).status).toBe('archived');
    });

    it('refuses to archive published content', () => {
      expect(() => aContent({ status: 'published' }).archive(T0)).toThrow(InvalidTransitionError);
    });
  });

  describe('schedule (FR-CONTENT-07)', () => {
    it.each(['draft', 'in_review'] as const)('schedules %s content', (status) => {
      const next = publishable({ status }).schedule(after(10), after(1));

      expect(next).toMatchObject({ status, scheduledAt: after(10) });
    });

    it.each(['published', 'unpublished', 'archived'] as const)('refuses %s content', (status) => {
      expect(() => publishable({ status }).schedule(after(10), T0)).toThrow(InvalidTransitionError);
    });

    it('refuses a time that is not in the future', () => {
      expect(() => publishable().schedule(T0, T0)).toThrow(InvalidScheduleError);
      expect(() => publishable().schedule(after(-1), T0)).toThrow(InvalidScheduleError);
    });

    it('accepts one millisecond ahead', () => {
      const soon = new Date(T0.getTime() + 1);

      expect(publishable().schedule(soon, T0).scheduledAt).toEqual(soon);
    });

    it('refuses content that could not be published', () => {
      expect(() => aContent().schedule(after(10), T0)).toThrow(MissingRequiredFieldsError);
    });

    it('describes a bad time as a field error', () => {
      expect(new InvalidScheduleError().details).toEqual({ field: 'scheduled_at' });
    });

    it('can be cancelled', () => {
      const next = publishable({ scheduledAt: after(10) }).cancelSchedule(T0);

      expect(next.scheduledAt).toBeNull();
      expect(next.status).toBe('draft');
    });
  });

  describe('softDelete (FR-CONTENT-13)', () => {
    it('marks the time and drops the schedule', () => {
      const next = publishable({ scheduledAt: after(10) }).softDelete(after(1));

      expect(next.deletedAt).toEqual(after(1));
      expect(next.scheduledAt).toBeNull();
    });
  });
});

describe('Content.edit', () => {
  it('changes only what is given', () => {
    const next = aContent({ tags: ['keep'] }).edit({ title: 'New' }, after(1));

    expect(next).toMatchObject({ title: 'New', tags: ['keep'], version: 2, updatedAt: after(1) });
  });

  it('can clear optional fields with null', () => {
    const next = aContent({ category: 'news', seoTitle: 'x' }).edit(
      { category: null, seoTitle: null },
      T0,
    );

    expect(next).toMatchObject({ category: null, seoTitle: null });
  });

  it('applies the same validation as create', () => {
    expect(fieldOf(() => aContent().edit({ title: ' ' }, T0))).toBe('title');
  });

  it('accepts a new slug', () => {
    expect(aContent().edit({ slug: 'new-slug' }, T0).slug).toBe('new-slug');
  });

  it('returns unpublished content to draft (02-SRS 5.4.1)', () => {
    expect(aContent({ status: 'unpublished' }).edit({ title: 'x' }, T0).status).toBe('draft');
  });

  it('keeps a published item published and refuses to leave it unpublishable', () => {
    const published = publishable({ status: 'published' });

    expect(published.edit({ title: 'x' }, T0).status).toBe('published');
    expect(() => published.edit({ body: EMPTY_DOCUMENT }, T0)).toThrow(MissingRequiredFieldsError);
  });

  it('refuses to edit archived content', () => {
    expect(() => aContent({ status: 'archived' }).edit({ title: 'x' }, T0)).toThrow(
      InvalidTransitionError,
    );
  });

  it('keeps a review item in review', () => {
    expect(aContent({ status: 'in_review' }).edit({ title: 'x' }, T0).status).toBe('in_review');
  });
});

describe('effectiveSeo (FR-SEO-02)', () => {
  it('defaults to the title and the first 160 characters of body text', () => {
    const seo = aContent({ title: 'My Title', body: aTextBody('b'.repeat(200)) }).effectiveSeo();

    expect(seo).toEqual({ title: 'My Title', description: 'b'.repeat(160) });
  });

  it('cuts a long title to 70 characters', () => {
    expect(aContent({ title: 't'.repeat(100) }).effectiveSeo().title).toHaveLength(70);
  });

  it('prefers the overrides', () => {
    const seo = aContent({
      body: aTextBody('body'),
      seoTitle: 'Custom',
      seoDescription: 'Desc',
    }).effectiveSeo();

    expect(seo).toEqual({ title: 'Custom', description: 'Desc' });
  });
});

describe('Content.restore', () => {
  it('round-trips persisted state', () => {
    const content = publishable({ status: 'published', publishedAt: T0, version: 7 });

    expect(Content.restore({ ...content })).toEqual(content);
  });
});

describe('content errors', () => {
  it.each([
    [new ContentNotFoundError(), 'not_found', 'NOT_FOUND'],
    [new SlugConflictError(), 'conflict', 'SLUG_TAKEN'],
    [new ConcurrentModificationError(), 'conflict', 'CONTENT_CHANGED'],
    [new InvalidSlugError(), 'validation', 'VALIDATION_ERROR'],
    [new InvalidContentError('title', 'Bad'), 'validation', 'VALIDATION_ERROR'],
    [new MissingRequiredFieldsError(['body']), 'validation', 'MISSING_REQUIRED_FIELDS'],
  ])('%o has the right kind and code', (error, kind, code) => {
    expect(error.kind).toBe(kind);
    expect(error.code).toBe(code);
  });

  it('names the field for slug problems', () => {
    expect(new SlugConflictError().details).toEqual({ field: 'slug' });
    expect(new InvalidSlugError().details).toEqual({ field: 'slug' });
  });

  it('keeps the message of an invalid field', () => {
    expect(new InvalidContentError('title', 'Too long').message).toBe('Too long');
  });

  it('reads a text node with no text as empty', () => {
    expect(plainText({ type: 'doc', content: [{ type: 'text' }] })).toBe('');
  });

  it('joins blocks that sit beside text without running their words together', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'two' },
            { type: 'text', text: '!' },
          ],
        },
      ],
    };

    expect(plainText(doc)).toBe('one two!');
  });

  it('counts a hard break as a word boundary', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'First' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Second' },
          ],
        },
      ],
    };

    expect(plainText(doc)).toBe('First Second');
  });

  it('removes markup from every text field a consumer could render', () => {
    const content = Content.create({
      id: 'id',
      type: 'article',
      authorId: 'a',
      slug: 'a-slug',
      now: new Date(0),
      fields: {
        title: '<script>x</script>Title',
        seoTitle: '<b>SEO</b>',
        seoDescription: '<img src=x onerror=alert(1)>Desc',
        tags: ['<i>tag</i>'],
        category: '<u>news</u>',
      },
    });

    expect(content).toMatchObject({
      title: 'Title',
      seoTitle: 'SEO',
      seoDescription: 'Desc',
      tags: ['tag'],
      category: 'news',
    });
  });

  it('removes markup from a review note', () => {
    const rejected = aContent({ status: 'in_review' }).reject('<b>Fix</b> this', new Date(0));

    expect(rejected.reviewNote).toBe('Fix this');
  });

  it('refuses a title that is nothing but markup', () => {
    expect(() =>
      Content.create({
        id: 'id',
        type: 'article',
        authorId: 'a',
        slug: 'a-slug',
        now: new Date(0),
        fields: { title: '<script>x</script>' },
      }),
    ).toThrow(InvalidContentError);
  });

  it('removes what PostgreSQL could not store from every text field', () => {
    const content = Content.create({
      id: 'id',
      type: 'article',
      authorId: 'a',
      slug: 'a-slug',
      now: new Date(0),
      fields: { title: 'T\0itle', seoTitle: 'S\0EO', tags: ['t\0ag'] },
    });

    expect(content).toMatchObject({ title: 'Title', seoTitle: 'SEO', tags: ['tag'] });
  });
});
