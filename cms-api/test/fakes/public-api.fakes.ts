import type {
  CacheEntry,
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

class InMemoryCacheEntry implements CacheEntry {
  constructor(
    readonly value: string | null,
    private readonly write: (value: string, ttlSeconds: number) => void,
  ) {}

  store(value: string, ttlSeconds: number): Promise<void> {
    this.write(value, ttlSeconds);
    return Promise.resolve();
  }
}

export class InMemoryResponseCache implements ResponseCache {
  readonly entries = new Map<string, string>();
  readonly ttls: number[] = [];
  private generation = 0;

  lookup(key: string): Promise<CacheEntry> {
    const generation = this.generation;
    return Promise.resolve(
      new InMemoryCacheEntry(this.entries.get(key) ?? null, (value, ttlSeconds) => {
        // Like the real one, a store from before an invalidation lands where nothing reads it.
        if (generation === this.generation) this.entries.set(key, value);
        this.ttls.push(ttlSeconds);
      }),
    );
  }

  invalidateAll(): Promise<void> {
    this.generation += 1;
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
