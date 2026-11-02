import type { Actor } from '../../../../shared/kernel/actor.js';
import type { Content, ContentEdit } from '../../domain/entities/content.entity.js';
import {
  ContentNotFoundError,
  InvalidContentError,
  MissingMediaError,
} from '../../domain/errors/content.errors.js';
import {
  type MediaReferencing,
  referencedMediaIds,
} from '../../domain/services/media-references.js';
import type { ContentEvent, ContentEventType } from '../../domain/events/content.events.js';
import type { ContentDeps } from '../content-deps.js';
import type { ContentFieldsPatch, ContentView } from '../ports/in/content.ports.js';
import type { ContentRepository, ContentSnapshot } from '../ports/out/content-repository.port.js';
import { sanitizeRichText } from '../sanitizer.service.js';

const VERSIONS_KEPT = 50;

export function toContentView(content: Content): ContentView {
  return {
    id: content.id,
    type: content.type,
    title: content.title,
    slug: content.slug,
    body: content.body,
    status: content.status,
    authorId: content.authorId,
    featuredImageId: content.featuredImageId,
    socialImageId: content.socialImageId,
    seoTitle: content.seoTitle,
    seoDescription: content.seoDescription,
    effectiveSeo: content.effectiveSeo(),
    tags: content.tags,
    category: content.category,
    parentId: content.parentId,
    scheduledAt: content.scheduledAt,
    publishedAt: content.publishedAt,
    reviewNote: content.reviewNote,
    version: content.version,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
  };
}

export function toSnapshot(content: Content): ContentSnapshot {
  return {
    title: content.title,
    slug: content.slug,
    body: content.body,
    featuredImageId: content.featuredImageId,
    socialImageId: content.socialImageId,
    seoTitle: content.seoTitle,
    seoDescription: content.seoDescription,
    tags: content.tags,
    category: content.category,
    parentId: content.parentId,
    status: content.status,
  };
}

export async function loadContent(contents: ContentRepository, id: string): Promise<Content> {
  const content = await contents.findById(id);
  if (!content) throw new ContentNotFoundError();
  return content;
}

// The body is untrusted until this runs, and nothing else may turn it into a document.
export function sanitizedFields<T extends ContentFieldsPatch>(
  fields: T,
): Omit<T, 'body'> & Pick<ContentEdit, 'body'> {
  const { body, ...rest } = fields;
  return { ...rest, ...(body === undefined ? {} : { body: sanitizeRichText(body) }) };
}

interface ReferenceContext extends MediaReferencing {
  readonly id: string | null;
  readonly category: string | null;
  readonly parentId: string | null;
}

function parentError(message: string): InvalidContentError {
  return new InvalidContentError('parentId', message);
}

async function assertValidParent(
  contents: ContentRepository,
  id: string | null,
  parentId: string,
): Promise<void> {
  if (parentId === id) throw parentError('A page cannot be its own parent');
  const parent = await contents.findById(parentId);
  if (parent?.type !== 'page') throw parentError('The parent must be an existing page');
  if (parent.parentId !== null) throw parentError('Pages nest one level only');
  if (id !== null && (await contents.hasChildren(id))) {
    throw parentError('A page with child pages cannot have a parent');
  }
}

async function assertMediaExists(
  deps: ContentDeps,
  current: ReferenceContext,
  changes: MediaReferencing,
): Promise<void> {
  const known = new Set(referencedMediaIds(current));
  const added = referencedMediaIds(changes).filter((id) => !known.has(id));
  if (added.length === 0) return;
  const missing = await deps.mediaCatalog.findMissing(added);
  if (missing.length > 0) throw new MissingMediaError(missing);
}

// Checked only when a value changes, so retiring a category does not block unrelated saves.
export async function assertValidReferences(
  deps: ContentDeps,
  current: ReferenceContext,
  changes: Pick<
    ContentEdit,
    'category' | 'parentId' | 'featuredImageId' | 'socialImageId' | 'body'
  >,
): Promise<void> {
  await assertMediaExists(deps, current, changes);
  const { category, parentId } = changes;
  const newCategory = category != null && category !== current.category;
  if (newCategory && !deps.contentCategories.includes(category)) {
    throw new InvalidContentError('category', 'Category is not one of the predefined values');
  }
  if (parentId != null && parentId !== current.parentId) {
    await assertValidParent(deps.contents, current.id, parentId);
  }
}

export interface ChangeRecord {
  readonly actorId: string | null;
  readonly ip: string | null;
  readonly action: string;
  readonly summary: Readonly<Record<string, unknown>>;
}

// FR-CONTENT-08 and FR-CONTENT-16: every saved state leaves a version and an audit event.
export async function recordChange(
  deps: ContentDeps,
  content: Content,
  record: ChangeRecord,
): Promise<void> {
  await deps.contents.addVersion(
    {
      id: deps.ids.next(),
      contentId: content.id,
      versionNo: content.version,
      snapshot: toSnapshot(content),
      editorId: record.actorId,
      createdAt: content.updatedAt,
    },
    VERSIONS_KEPT,
  );
  await deps.audit.record({
    actorId: record.actorId,
    actorIp: record.ip,
    action: record.action,
    targetType: 'content',
    targetId: content.id,
    summary: record.summary,
  });
}

export function publishContentEvent(
  deps: ContentDeps,
  type: ContentEventType,
  content: Content,
): Promise<void> {
  const event: ContentEvent = {
    type,
    contentId: content.id,
    contentType: content.type,
    slug: content.slug,
  };
  return deps.events.publishAll([event]);
}

export interface ContentMutation {
  readonly actor: Actor;
  readonly id: string;
  readonly ip: string | null;
  readonly action: string;
  readonly event?: ContentEventType;
  authorize(content: Content): void;
  // Returning the same instance means there is nothing to save.
  change(content: Content): Content | Promise<Content>;
  summary(before: Content, after: Content): Readonly<Record<string, unknown>>;
}

// Load, check, save, record, all in one transaction. Events wait for the commit (ADR-0009).
export async function mutateContent(
  deps: ContentDeps,
  mutation: ContentMutation,
): Promise<Content> {
  const after = await deps.tx.run(async () => {
    const before = await loadContent(deps.contents, mutation.id);
    mutation.authorize(before);
    const changed = await mutation.change(before);
    if (changed === before) return before;

    await deps.contents.save(changed);
    await recordChange(deps, changed, {
      actorId: mutation.actor.id,
      ip: mutation.ip,
      action: mutation.action,
      summary: mutation.summary(before, changed),
    });
    return changed;
  });
  if (mutation.event) await publishContentEvent(deps, mutation.event, after);
  return after;
}
