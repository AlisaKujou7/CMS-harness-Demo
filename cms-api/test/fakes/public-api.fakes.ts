import type {
  PublicContentType,
  PublicMediaReader,
  PublicMediaRecord,
  PublishedContentReader,
  PublishedDetailRecord,
  PublishedQuery,
  PublishedSummaryRecord,
  ResponseCache,
} from '../../src/modules/public-api/application/ports/out/public-sources.port.js';
import {
  pagedResult,
  type PagedResult,
  type PageRequest,
} from '../../src/shared/kernel/paged-result.js';

export class InMemoryResponseCache implements ResponseCache {
  readonly entries = new Map<string, string>();
  readonly ttls: number[] = [];

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.entries.get(key) ?? null);
  }

  set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, value);
    this.ttls.push(ttlSeconds);
    return Promise.resolve();
  }

  invalidateAll(): Promise<void> {
    this.entries.clear();
    return Promise.resolve();
  }
}

export class FakePublishedContentReader implements PublishedContentReader {
  readonly items: PublishedDetailRecord[] = [];
  readonly usage = new Map<string, number>();
  readonly queries: PublishedQuery[] = [];
  reads = 0;

  list(query: PublishedQuery, page: PageRequest): Promise<PagedResult<PublishedSummaryRecord>> {
    this.reads += 1;
    this.queries.push(query);
    const start = (page.page - 1) * page.pageSize;
    return Promise.resolve(
      pagedResult(this.items.slice(start, start + page.pageSize), this.items.length, page),
    );
  }

  findBySlug(_type: PublicContentType, slug: string): Promise<PublishedDetailRecord | null> {
    this.reads += 1;
    return Promise.resolve(this.items.find((item) => item.slug === slug) ?? null);
  }

  countMediaUsage(mediaId: string): Promise<number> {
    return Promise.resolve(this.usage.get(mediaId) ?? 0);
  }
}

export class FakePublicMediaReader implements PublicMediaReader {
  readonly records: PublicMediaRecord[] = [];

  findByIds(ids: readonly string[]): Promise<readonly PublicMediaRecord[]> {
    return Promise.resolve(this.records.filter((record) => ids.includes(record.id)));
  }
}
