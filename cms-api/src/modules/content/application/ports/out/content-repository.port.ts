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

export type ContentVersionSummary = Omit<ContentVersion, 'snapshot'>;

export type ContentCounts = Readonly<Record<ContentStatus, number>>;

export interface ContentRepository {
  // Soft-deleted items do not exist as far as every caller is concerned.
  findById(id: string): Promise<Content | null>;
  findMany(criteria: ContentCriteria, page: PageRequest): Promise<PagedResult<ContentListItem>>;
  countByStatus(authorId: string | null): Promise<ContentCounts>;
  // Counts soft-deleted items too, since the unique index still holds their slugs.
  slugExists(type: ContentType, slug: string): Promise<boolean>;
  hasChildren(id: string): Promise<boolean>;
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
  // Versions go with the item, and child pages lose their parent. Returns how many were removed.
  purgeDeletedBefore(cutoff: Date): Promise<number>;
}
