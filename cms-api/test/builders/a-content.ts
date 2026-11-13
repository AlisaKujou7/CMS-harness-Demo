import {
  Content,
  type ContentProps,
} from '../../src/modules/content/domain/entities/content.entity.js';
import {
  EMPTY_DOCUMENT,
  type RichTextNode,
} from '../../src/modules/content/domain/services/rich-text.js';

export const T0 = new Date('2026-05-11T10:00:00.000Z');
export const after = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

export function aTextBody(text: string): RichTextNode {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

export function aContent(overrides: Partial<ContentProps> = {}): Content {
  return Content.restore({
    id: 'content-1',
    type: 'article',
    title: 'A Title',
    slug: 'a-title',
    body: EMPTY_DOCUMENT,
    status: 'draft',
    authorId: 'author-1',
    featuredImageId: null,
    socialImageId: null,
    seoTitle: null,
    seoDescription: null,
    tags: [],
    category: null,
    parentId: null,
    scheduledAt: null,
    publishedAt: null,
    deletedAt: null,
    reviewNote: null,
    version: 1,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  });
}
