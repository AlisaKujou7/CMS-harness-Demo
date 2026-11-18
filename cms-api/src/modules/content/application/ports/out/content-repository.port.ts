import type { PagedResult, PageRequest } from '../../../../../shared/kernel/paged-result.js';
import type { Content, ContentType } from '../../../domain/entities/content.entity.js';
import type { ContentStatus } from '../../../domain/services/content-lifecycle.service.js';
import type { RichTextNode } from '../../../domain/services/rich-text.js';

export type ContentSortField = 'updated_at' | 'created_at' | 'title';

export interface ContentCriteria {
  readonly status?: ContentStatus;
  readonly type?: ContentType;
  readonly authorId?: string;
  readonly tag?: string;
  readonly updatedFrom?: Date;
  readonly updatedTo?: Date;
  readonly search?: string;
  readonly sortBy: ContentSortField;
  readonly descending: boolean;
}

// A list row: everything but the body, which can be large, plus the author's name for display.
export interface ContentListItem {
  readonly id: string;
  readonly type: ContentType;
  readonly title: string;
  readonly slug: string;
  readonly status: ContentStatus;
  readonly authorId: string;
  readonly authorName: string;
  readonly tags: readonly string[];
  readonly category: string | null;
  readonly scheduledAt: Date | null;
  readonly publishedAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PublishedCriteria {
  readonly type: ContentType;
  readonly tag?: string;
  readonly category?: string;
}

// Only ever a parent that is itself public, so a draft page is never confirmed to exist.
export interface PublishedParent {
  readonly slug: string;
  readonly title: string;
}

export interface PublishedListItem {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly authorName: string;
  readonly tags: readonly string[];
  readonly category: string | null;
  readonly parent: PublishedParent | null;
  readonly featuredImageId: string | null;
  readonly version: number;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
}

// What a version keeps and a revert restores. Lifecycle state is not part of it (FR-CONTENT-09).
export interface ContentSnapshot {
  readonly title: string;
  readonly slug: string;
  readonly body: RichTextNode;
  readonly featuredImageId: string | null;
  readonly socialImageId: string | null;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly tags: readonly string[];
  readonly category: string | null;
  readonly parentId: string | null;
  readonly status: ContentStatus;
}

export interface ContentVersion {
  readonly id: string;
  readonly contentId: string;
  readonly versionNo: number;
  readonly snapshot: ContentSnapshot;
  readonly editorId: string | null;
  readonly createdAt: Date;
}

// A list row names the editor for display, while a version itself only keeps the reference.
export type ContentVersionSummary = Omit<ContentVersion, 'snapshot'> & {
  readonly editorName: string | null;
};

export type ContentCounts = Readonly<Record<ContentStatus, number>>;

export interface ContentRepository {
  // The one definition of public (FR-PUBAPI-03): status published, published_at not after now, and
  // not deleted. These are the only reads that may reach the public API.
  findPublished(
    criteria: PublishedCriteria,
    page: PageRequest,
    now: Date,
  ): Promise<PagedResult<PublishedListItem>>;
  findPublishedBySlug(
    type: ContentType,
    slug: string,
    now: Date,
  ): Promise<{
    readonly content: Content;
    readonly authorName: string;
    readonly parent: PublishedParent | null;
  } | null>;
  countPublishedMediaUsage(mediaId: string, now: Date): Promise<number>;
  // The one read that sees a soft-deleted item, so that Undo can bring it back.
  findDeletedById(id: string): Promise<Content | null>;
  // Soft-deleted items do not exist as far as every other caller is concerned.
  findById(id: string): Promise<Content | null>;
  findMany(criteria: ContentCriteria, page: PageRequest): Promise<PagedResult<ContentListItem>>;
  countByStatus(authorId: string | null): Promise<ContentCounts>;
  // A soft-deleted item gives up its slug, because nothing can show or free it for those 30 days.
  slugExists(type: ContentType, slug: string): Promise<boolean>;
  hasChildren(id: string): Promise<boolean>;
  // How many live items reference this media, as a featured or social image or inside the body.
  countMediaUsage(mediaId: string): Promise<number>;
  // Throws SlugConflictError when another item of this type holds the slug.
  create(content: Content): Promise<void>;
  // Writes only over the version this change was made from. Throws ConcurrentModificationError
  // when someone else saved first, and SlugConflictError as create does.
  save(content: Content): Promise<void>;
  // Keeps the newest versions only, in the same transaction as the save (02-SRS 6.4).
  addVersion(version: ContentVersion, keep: number): Promise<void>;
  findVersions(contentId: string, page: PageRequest): Promise<PagedResult<ContentVersionSummary>>;
  findVersion(contentId: string, versionNo: number): Promise<ContentVersion | null>;
  findDueForPublish(now: Date, limit: number): Promise<readonly string[]>;
  // Removes up to limit items, oldest first, and returns their ids. Versions go with each item,
  // and child pages lose their parent.
  purgeDeletedBefore(cutoff: Date, limit: number): Promise<readonly string[]>;
}
