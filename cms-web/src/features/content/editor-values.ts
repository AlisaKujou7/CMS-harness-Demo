import { z } from 'zod';
import type {
  ContentCreateBody,
  ContentDetail,
  ContentPatchBody,
  ContentType,
} from '../../shared/api/types';
import { contentMessages as m } from './content.messages';
import { sameDoc, storedUrlsOf, withStoredUrls, EMPTY_DOC } from './rich-text';
import type { EditorValues, RichTextDoc } from './types/content.types';

export const MAX_SEO_TITLE = 70;
export const MAX_SEO_DESCRIPTION = 160;
const MAX_TITLE = 200;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const editorSchema = z.object({
  title: z.string().trim().min(1, m.editor.titleRequired).max(MAX_TITLE, m.editor.titleTooLong),
  slug: z.string().refine((value) => value === '' || SLUG.test(value), m.editor.slugInvalid),
  body: z.custom<RichTextDoc>(),
  seo_title: z.string().max(MAX_SEO_TITLE, m.editor.tooLong),
  seo_description: z.string().max(MAX_SEO_DESCRIPTION, m.editor.tooLong),
  featured_image_id: z.string(),
  social_image_id: z.string(),
  tags: z.array(z.string()),
  category: z.string(),
  parent_id: z.string(),
});

export const EMPTY_VALUES: EditorValues = {
  title: '',
  slug: '',
  body: EMPTY_DOC,
  seo_title: '',
  seo_description: '',
  featured_image_id: '',
  social_image_id: '',
  tags: [],
  category: '',
  parent_id: '',
};

export function toValues(content: ContentDetail): EditorValues {
  return {
    title: content.title,
    slug: content.slug,
    body: content.body as RichTextDoc,
    seo_title: content.seo_title ?? '',
    seo_description: content.seo_description ?? '',
    featured_image_id: content.featured_image_id ?? '',
    social_image_id: content.social_image_id ?? '',
    tags: [...content.tags],
    category: content.category ?? '',
    parent_id: content.parent_id ?? '',
  };
}

const NULLABLE_FIELDS = [
  'seo_title',
  'seo_description',
  'featured_image_id',
  'social_image_id',
  'category',
  'parent_id',
] as const;

const orNull = (value: string) => (value === '' ? null : value);

function changedNullables(before: EditorValues, after: EditorValues): Partial<ContentPatchBody> {
  return Object.fromEntries(
    NULLABLE_FIELDS.flatMap((name) =>
      before[name] === after[name] ? [] : [[name, orNull(after[name])]],
    ),
  );
}

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index]);
}

// Only what changed goes to the server, and null means there is nothing to save.
export function toPatch(
  before: EditorValues,
  after: EditorValues,
): Omit<ContentPatchBody, 'version'> | null {
  const stored = storedUrlsOf(before.body);
  const patch = {
    ...(before.title === after.title ? {} : { title: after.title }),
    ...(before.slug === after.slug || after.slug === '' ? {} : { slug: after.slug }),
    ...(sameDoc(before.body, after.body) ? {} : { body: withStoredUrls(after.body, stored) }),
    ...(sameTags(before.tags, after.tags) ? {} : { tags: after.tags }),
    ...changedNullables(before, after),
  };
  return Object.keys(patch).length === 0 ? null : patch;
}

export function toCreateBody(type: ContentType, values: EditorValues): ContentCreateBody {
  const patch = toPatch(EMPTY_VALUES, values);
  return { ...patch, type, title: values.title };
}

export function toDuplicate(content: ContentDetail, title: string): ContentCreateBody {
  const values = { ...toValues(content), slug: '', title: title.slice(0, MAX_TITLE) };
  return toCreateBody(content.type, values);
}
