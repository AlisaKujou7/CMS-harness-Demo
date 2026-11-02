import type { PublicBodyNode, PublicContentType } from '../out/public-sources.port.js';

export interface PublicMedia {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly url: string;
  readonly variants: Readonly<
    Record<string, { readonly url: string; readonly width: number; readonly height: number }>
  >;
}

export interface PublicContentSummary {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly authorName: string;
  readonly tags: readonly string[];
  readonly category: string | null;
  readonly parentId: string | null;
  readonly featuredImage: PublicMedia | null;
  readonly publishedAt: string;
  readonly updatedAt: string;
}

export interface PublicContentDetail extends PublicContentSummary {
  readonly body: PublicBodyNode;
  readonly seo: {
    readonly title: string;
    readonly description: string;
    readonly socialImage: PublicMedia | null;
  };
}

export interface PublicPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

// All text, because it may have come back from the cache. cacheTag names this version of the
// response without counting signed URLs, which differ on every request.
export interface PublicResponse<T> {
  readonly data: T;
  readonly cacheTag: string;
  readonly lastModified: string;
}

export interface ListPublishedContentCommand {
  readonly type: PublicContentType;
  readonly page?: number;
  readonly pageSize?: number;
  readonly tag?: string;
  readonly category?: string;
}

export interface PublicContentList {
  readonly items: readonly PublicContentSummary[];
  readonly pagination: PublicPagination;
}

export interface ListPublishedContentUseCase {
  execute(command: ListPublishedContentCommand): Promise<PublicResponse<PublicContentList>>;
}

export interface GetPublishedContentUseCase {
  execute(command: {
    readonly type: PublicContentType;
    readonly slug: string;
  }): Promise<PublicResponse<PublicContentDetail>>;
}

export interface GetPublicMediaUseCase {
  execute(command: { readonly id: string }): Promise<PublicResponse<PublicMedia>>;
}

export interface InvalidatePublicCacheUseCase {
  execute(): Promise<void>;
}
