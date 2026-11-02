import {
  InvalidContentError,
  InvalidScheduleError,
  InvalidTransitionError,
} from '../errors/content.errors.js';
import { assertTransition, type ContentStatus } from '../services/content-lifecycle.service.js';
import { assertPublishable } from '../services/publish-requirements-checker.js';
import { cleanText, EMPTY_DOCUMENT, plainText, type RichTextNode } from '../services/rich-text.js';
import { Slug } from '../value-objects/slug.vo.js';

const MAX_TITLE_LENGTH = 200;
const MAX_SEO_TITLE_LENGTH = 70;
const MAX_SEO_DESCRIPTION_LENGTH = 160;
const MAX_TAG_LENGTH = 40;
const MAX_TAGS = 50;
const MAX_NOTE_LENGTH = 2000;

export type ContentType = 'article' | 'page';

interface EditableFields {
  readonly title: string;
  readonly body: RichTextNode;
  readonly featuredImageId: string | null;
  readonly socialImageId: string | null;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly tags: readonly string[];
  readonly category: string | null;
  readonly parentId: string | null;
}

export type ContentFieldsInput = Partial<EditableFields> & { readonly title: string };
export type ContentEdit = Partial<EditableFields> & { readonly slug?: string };

export interface ContentProps extends EditableFields {
  readonly id: string;
  readonly type: ContentType;
  readonly slug: string;
  readonly status: ContentStatus;
  readonly authorId: string;
  readonly scheduledAt: Date | null;
  readonly publishedAt: Date | null;
  readonly deletedAt: Date | null;
  readonly reviewNote: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function validTitle(input: string): string {
  const title = cleanText(input).trim();
  if (title === '' || title.length > MAX_TITLE_LENGTH) {
    throw new InvalidContentError('title', 'Title must be between 1 and 200 characters');
  }
  return title;
}

function optionalText(field: string, input: string | null, max: number): string | null {
  const value = cleanText(input ?? '').trim();
  if (value.length > max) {
    throw new InvalidContentError(field, `Must be at most ${String(max)} characters`);
  }
  return value === '' ? null : value;
}

function validTags(input: readonly string[]): readonly string[] {
  const tags = [...new Set(input.map((tag) => cleanText(tag).trim().toLowerCase()))];
  const invalid = tags.some((tag) => tag === '' || tag.length > MAX_TAG_LENGTH);
  if (invalid || tags.length > MAX_TAGS) {
    throw new InvalidContentError('tags', 'Use up to 50 tags of 1 to 40 characters each');
  }
  return tags;
}

function assertTypeRules(type: ContentType, fields: EditableFields): void {
  if (type === 'article' && fields.parentId !== null) {
    throw new InvalidContentError('parentId', 'Only a page can have a parent');
  }
  if (type === 'page' && fields.tags.length > 0) {
    throw new InvalidContentError('tags', 'A page has no tags');
  }
  if (type === 'page' && fields.category !== null) {
    throw new InvalidContentError('category', 'A page has no category');
  }
}

function normalizeFields(type: ContentType, fields: EditableFields): EditableFields {
  const normalized: EditableFields = {
    ...fields,
    title: validTitle(fields.title),
    seoTitle: optionalText('seoTitle', fields.seoTitle, MAX_SEO_TITLE_LENGTH),
    seoDescription: optionalText(
      'seoDescription',
      fields.seoDescription,
      MAX_SEO_DESCRIPTION_LENGTH,
    ),
    tags: validTags(fields.tags),
    category: optionalText('category', fields.category, MAX_TITLE_LENGTH),
  };
  assertTypeRules(type, normalized);
  return normalized;
}

export class Content implements ContentProps {
  readonly id: string;
  readonly type: ContentType;
  readonly title: string;
  readonly slug: string;
  readonly body: RichTextNode;
  readonly status: ContentStatus;
  readonly authorId: string;
  readonly featuredImageId: string | null;
  readonly socialImageId: string | null;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly tags: readonly string[];
  readonly category: string | null;
  readonly parentId: string | null;
  readonly scheduledAt: Date | null;
  readonly publishedAt: Date | null;
  readonly deletedAt: Date | null;
  readonly reviewNote: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ContentProps) {
    this.id = props.id;
    this.type = props.type;
    this.title = props.title;
    this.slug = props.slug;
    this.body = props.body;
    this.status = props.status;
    this.authorId = props.authorId;
    this.featuredImageId = props.featuredImageId;
    this.socialImageId = props.socialImageId;
    this.seoTitle = props.seoTitle;
    this.seoDescription = props.seoDescription;
    this.tags = props.tags;
    this.category = props.category;
    this.parentId = props.parentId;
    this.scheduledAt = props.scheduledAt;
    this.publishedAt = props.publishedAt;
    this.deletedAt = props.deletedAt;
    this.reviewNote = props.reviewNote;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: {
    id: string;
    type: ContentType;
    authorId: string;
    slug: string;
    now: Date;
    fields: ContentFieldsInput;
  }): Content {
    const fields = normalizeFields(input.type, {
      body: EMPTY_DOCUMENT,
      featuredImageId: null,
      socialImageId: null,
      seoTitle: null,
      seoDescription: null,
      tags: [],
      category: null,
      parentId: null,
      ...input.fields,
    });
    return new Content({
      ...fields,
      id: input.id,
      type: input.type,
      authorId: input.authorId,
      slug: Slug.create(input.slug).value,
      status: 'draft',
      scheduledAt: null,
      publishedAt: null,
      deletedAt: null,
      reviewNote: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: ContentProps): Content {
    return new Content(props);
  }

  // Every change raises the version, which is what the repository checks to refuse stale writes.
  private next(changes: Partial<ContentProps>, now: Date): Content {
    return new Content({ ...this, ...changes, version: this.version + 1, updatedAt: now });
  }

  edit(changes: ContentEdit, now: Date): Content {
    const { slug, ...fields } = changes;
    if (this.status === 'archived') throw new InvalidTransitionError('archived', 'draft');

    const normalized = normalizeFields(this.type, { ...this, ...fields });
    if (this.status === 'published') assertPublishable(normalized);
    return this.next(
      {
        ...normalized,
        slug: slug === undefined ? this.slug : Slug.create(slug).value,
        status: this.status === 'unpublished' ? 'draft' : this.status,
      },
      now,
    );
  }

  submit(now: Date): Content {
    assertTransition(this.status, 'in_review');
    return this.next({ status: 'in_review', reviewNote: null }, now);
  }

  publish(now: Date): Content {
    assertTransition(this.status, 'published');
    assertPublishable(this);
    return this.next(
      {
        status: 'published',
        publishedAt: this.publishedAt ?? now,
        scheduledAt: null,
        reviewNote: null,
      },
      now,
    );
  }

  reject(note: string, now: Date): Content {
    assertTransition(this.status, 'draft');
    return this.next(
      {
        status: 'draft',
        reviewNote: optionalText('note', note, MAX_NOTE_LENGTH),
        scheduledAt: null,
      },
      now,
    );
  }

  unpublish(now: Date): Content {
    assertTransition(this.status, 'unpublished');
    return this.next({ status: 'unpublished' }, now);
  }

  archive(now: Date): Content {
    assertTransition(this.status, 'archived');
    return this.next({ status: 'archived' }, now);
  }

  schedule(at: Date, now: Date): Content {
    assertTransition(this.status, 'published');
    if (at <= now) throw new InvalidScheduleError();
    assertPublishable(this);
    return this.next({ scheduledAt: at }, now);
  }

  cancelSchedule(now: Date): Content {
    return this.next({ scheduledAt: null }, now);
  }

  softDelete(now: Date): Content {
    return this.next({ deletedAt: now, scheduledAt: null }, now);
  }

  effectiveSeo(): { title: string; description: string } {
    return {
      title: this.seoTitle ?? this.title.slice(0, MAX_SEO_TITLE_LENGTH),
      description: this.seoDescription ?? plainText(this.body).slice(0, MAX_SEO_DESCRIPTION_LENGTH),
    };
  }
}
