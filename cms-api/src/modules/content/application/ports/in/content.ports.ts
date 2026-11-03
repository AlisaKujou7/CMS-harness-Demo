import type { Actor } from '../../../../../shared/kernel/actor.js';
import type { PagedResult, PageRequest } from '../../../../../shared/kernel/paged-result.js';
import type { ContentType } from '../../../domain/entities/content.entity.js';
import type { ContentStatus } from '../../../domain/services/content-lifecycle.service.js';
import type { RichTextNode } from '../../../domain/services/rich-text.js';
import type {
  ContentCounts,
  ContentCriteria,
  ContentListItem,
  ContentSnapshot,
  ContentVersionSummary,
  PublishedCriteria,
  PublishedListItem,
  PublishedParent,
} from '../out/content-repository.port.js';

export interface ContentView {
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
  readonly effectiveSeo: { readonly title: string; readonly description: string };
  readonly tags: readonly string[];
  readonly category: string | null;
  readonly parentId: string | null;
  readonly scheduledAt: Date | null;
  readonly publishedAt: Date | null;
  readonly reviewNote: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ContentCommand {
  readonly actor: Actor;
  readonly id: string;
  readonly ip: string | null;
}

// The body arrives as untrusted JSON, and sanitizing it is what gives it a shape.
export interface ContentFieldsPatch {
  readonly title?: string;
  readonly body?: unknown;
  readonly featuredImageId?: string | null;
  readonly socialImageId?: string | null;
  readonly seoTitle?: string | null;
  readonly seoDescription?: string | null;
  readonly tags?: readonly string[];
  readonly category?: string | null;
  readonly parentId?: string | null;
}

export type CreateContentCommand = ContentFieldsPatch & {
  readonly actor: Actor;
  readonly ip: string | null;
  readonly type: ContentType;
  readonly title: string;
  readonly slug?: string;
};

export type UpdateContentCommand = ContentCommand &
  ContentFieldsPatch & {
    readonly slug?: string;
    // The version the editor loaded, so a save over someone else's work is refused.
    readonly version: number;
  };

export interface ListContentCommand extends Partial<
  Omit<ContentCriteria, 'sortBy' | 'descending'>
> {
  readonly actor: Actor;
  readonly sortBy?: ContentCriteria['sortBy'];
  readonly descending?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ContentVersionDetail extends ContentVersionSummary {
  readonly snapshot: ContentSnapshot;
}

export interface CreateContentUseCase {
  execute(command: CreateContentCommand): Promise<ContentView>;
}

export interface UpdateContentUseCase {
  execute(command: UpdateContentCommand): Promise<ContentView>;
}

export interface ContentActionUseCase {
  execute(command: ContentCommand): Promise<ContentView>;
}

export interface RejectContentUseCase {
  execute(command: ContentCommand & { readonly note: string }): Promise<ContentView>;
}

export interface ScheduleContentUseCase {
  execute(command: ContentCommand & { readonly scheduledAt: Date | null }): Promise<ContentView>;
}

export interface DeleteContentUseCase {
  execute(command: ContentCommand): Promise<void>;
}

export interface GetContentUseCase {
  execute(command: { readonly actor: Actor; readonly id: string }): Promise<ContentView>;
}

export interface ListContentUseCase {
  execute(command: ListContentCommand): Promise<PagedResult<ContentListItem>>;
}

export interface ContentCategoriesUseCase {
  execute(): readonly string[];
}

export interface CountMediaUsageUseCase {
  execute(mediaId: string): Promise<number>;
}

export interface ContentStatsUseCase {
  execute(command: { readonly actor: Actor }): Promise<ContentCounts>;
}

export interface ListContentVersionsUseCase {
  execute(command: {
    readonly actor: Actor;
    readonly id: string;
    readonly page?: number;
    readonly pageSize?: number;
  }): Promise<PagedResult<ContentVersionSummary>>;
}

export interface GetContentVersionUseCase {
  execute(command: {
    readonly actor: Actor;
    readonly id: string;
    readonly versionNo: number;
  }): Promise<ContentVersionDetail>;
}

export interface RevertContentUseCase {
  execute(command: ContentCommand & { readonly versionNo: number }): Promise<ContentView>;
}

export interface PublishedDetail extends Omit<ContentView, 'publishedAt'> {
  readonly authorName: string;
  readonly parent: PublishedParent | null;
  readonly publishedAt: Date;
}

export interface PublishedContentQueries {
  list(criteria: PublishedCriteria, page: PageRequest): Promise<PagedResult<PublishedListItem>>;
  findBySlug(type: ContentType, slug: string): Promise<PublishedDetail | null>;
  countMediaUsage(mediaId: string): Promise<number>;
}

export interface PublishDueContentUseCase {
  execute(): Promise<number>;
}

export interface PurgeDeletedContentUseCase {
  execute(): Promise<number>;
}

export type { ContentCounts, ContentListItem, ContentSnapshot, ContentVersionSummary };
