import type { PagedResult, PageRequest } from '../../../../../shared/kernel/paged-result.js';

export type PublicContentType = 'article' | 'page';

export interface PublicBodyNode {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly PublicBodyNode[];
  readonly marks?: readonly unknown[];
  readonly text?: string;
}

export interface PublishedQuery {
  readonly type: PublicContentType;
  readonly tag?: string;
  readonly category?: string;
}

export interface PublishedSummaryRecord {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly authorName: string;
  readonly tags: readonly string[];
  readonly category: string | null;
  readonly parentId: string | null;
  readonly featuredImageId: string | null;
  readonly version: number;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
}

export interface PublishedDetailRecord extends PublishedSummaryRecord {
  readonly body: PublicBodyNode;
  readonly socialImageId: string | null;
  readonly effectiveSeo: { readonly title: string; readonly description: string };
}

// The content module's answer, reached through the composition root. It alone decides what counts
// as public (FR-PUBAPI-03), so nothing here can ask for anything else.
export interface PublishedContentReader {
  list(query: PublishedQuery, page: PageRequest): Promise<PagedResult<PublishedSummaryRecord>>;
  findBySlug(type: PublicContentType, slug: string): Promise<PublishedDetailRecord | null>;
  countMediaUsage(mediaId: string): Promise<number>;
}

export interface PublicMediaRecord {
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
  readonly variantStatus: string;
  readonly createdAt: Date;
}

// The media module's answer, reached through the composition root.
export interface PublicMediaReader {
  findByIds(ids: readonly string[]): Promise<readonly PublicMediaRecord[]>;
}

// Strings, because a cached response must come back exactly as it went in.
export interface ResponseCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  invalidateAll(): Promise<void>;
}
