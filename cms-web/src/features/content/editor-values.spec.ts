import { describe, expect, it } from 'vitest';
import { aContent, ID } from '../../../test/builders';
import {
  editorSchema,
  EMPTY_VALUES,
  toCreateBody,
  toDuplicate,
  toPatch,
  toValues,
} from './editor-values';
import type { EditorValues } from './types/content.types';

const values = (overrides: Partial<EditorValues> = {}): EditorValues => ({
  ...EMPTY_VALUES,
  title: 'T',
  ...overrides,
});
const parse = (overrides: Partial<EditorValues>) => editorSchema.safeParse(values(overrides));

describe('editorSchema', () => {
  it('asks only for a title (FR-CONTENT-05)', () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ title: '   ' }).error?.issues[0]?.message).toBe('A title is required');
  });

  it('holds fields to their limits (FR-SEO-01)', () => {
    expect(parse({ title: 'x'.repeat(200) }).success).toBe(true);
    expect(parse({ title: 'x'.repeat(201) }).success).toBe(false);
    expect(parse({ seo_title: 'x'.repeat(70) }).success).toBe(true);
    expect(parse({ seo_title: 'x'.repeat(71) }).success).toBe(false);
    expect(parse({ seo_description: 'x'.repeat(160) }).success).toBe(true);
    expect(parse({ seo_description: 'x'.repeat(161) }).success).toBe(false);
  });

  it.each([
    ['', true],
    ['q2-report', true],
    ['a1', true],
    ['Bad', false],
    ['two--hyphens', false],
    ['-leading', false],
    ['trailing-', false],
    ['with space', false],
  ])('checks a slug of %j: %s', (slug, valid) => {
    expect(parse({ slug }).success).toBe(valid);
  });
});

describe('toValues', () => {
  it('turns nulls into empty fields', () => {
    expect(toValues(aContent())).toMatchObject({
      seo_title: '',
      seo_description: '',
      featured_image_id: '',
      social_image_id: '',
      category: '',
      parent_id: '',
    });
  });

  it('keeps what is set', () => {
    const content = aContent({
      seo_title: 'S',
      seo_description: 'D',
      featured_image_id: ID.media,
      social_image_id: ID.other,
      category: 'news',
      parent_id: ID.user,
      tags: ['a'],
    });

    expect(toValues(content)).toMatchObject({
      seo_title: 'S',
      seo_description: 'D',
      featured_image_id: ID.media,
      social_image_id: ID.other,
      category: 'news',
      parent_id: ID.user,
      tags: ['a'],
    });
  });
});

describe('toPatch', () => {
  const base = values();

  it('answers null when nothing changed', () => {
    expect(toPatch(base, values())).toBeNull();
  });

  it.each<[string, Partial<EditorValues>, object]>([
    ['the title', { title: 'New' }, { title: 'New' }],
    ['the slug', { slug: 'new' }, { slug: 'new' }],
    ['tags', { tags: ['a'] }, { tags: ['a'] }],
    ['a nullable field', { seo_title: 'S' }, { seo_title: 'S' }],
    ['a media field', { featured_image_id: ID.media }, { featured_image_id: ID.media }],
  ])('sends only %s', (_name, change, patch) => {
    expect(toPatch(base, values(change))).toEqual(patch);
  });

  it('clears a nullable field with null', () => {
    expect(toPatch(values({ category: 'news' }), values())).toEqual({ category: null });
  });

  it('notices tags in another order, and the same count of other tags', () => {
    expect(toPatch(values({ tags: ['a', 'b'] }), values({ tags: ['b', 'a'] }))).toEqual({
      tags: ['b', 'a'],
    });
    expect(toPatch(values({ tags: ['a'] }), values({ tags: [] }))).toEqual({ tags: [] });
  });

  it('never clears a slug, since the server would refuse an empty one', () => {
    expect(toPatch(values({ slug: 'old' }), values({ slug: '' }))).toBeNull();
  });

  it('sends a changed body with stored image URLs', () => {
    const image = (src: string, alt: string) => ({
      type: 'image',
      attrs: { src, alt, mediaId: ID.media },
    });
    const before = values({ body: { type: 'doc', content: [image('https://stored', 'A')] } });
    const after = values({ body: { type: 'doc', content: [image('https://fresh', 'B')] } });

    expect(toPatch(before, after)).toEqual({
      body: { type: 'doc', content: [image('https://stored', 'B')] },
    });
  });

  it('does not count a fresh image URL as a change', () => {
    const image = (src: string) => ({ type: 'image', attrs: { src, mediaId: ID.media } });
    const before = values({ body: { type: 'doc', content: [image('https://stored')] } });
    const after = values({ body: { type: 'doc', content: [image('https://fresh')] } });

    expect(toPatch(before, after)).toBeNull();
  });
});

describe('toCreateBody', () => {
  it('sends the type and whatever was filled in', () => {
    expect(toCreateBody('page', values({ title: 'T', seo_title: 'S' }))).toEqual({
      type: 'page',
      title: 'T',
      seo_title: 'S',
    });
  });
});

describe('toDuplicate', () => {
  it('copies everything but the slug, which the server makes anew', () => {
    const content = aContent({ type: 'page', slug: 'old', tags: ['a'], seo_title: 'S' });

    expect(toDuplicate(content, 'Copy of T')).toEqual({
      type: 'page',
      title: 'Copy of T',
      tags: ['a'],
      seo_title: 'S',
    });
  });

  it('keeps the new title within the limit', () => {
    expect(toDuplicate(aContent(), 'x'.repeat(300)).title).toHaveLength(200);
  });
});
