import type {
  MediaCriteria,
  MediaRepository,
  MediaWithUploader,
  VariantResult,
} from '../../src/modules/media/application/ports/out/media-repository.port.js';
import type {
  ImageProcessor,
  MediaUsageReader,
  MediaVariantQueue,
  ObjectStorage,
  ProcessedImage,
  ReadRequest,
  ReadUrlRequest,
  StoredObject,
  SvgSanitizer,
  UploadUrlRequest,
} from '../../src/modules/media/application/ports/out/media-services.port.js';
import {
  MediaItem,
  type MediaMetadata,
} from '../../src/modules/media/domain/entities/media-item.entity.js';
import { MediaAlreadyExistsError } from '../../src/modules/media/domain/errors/media.errors.js';
import {
  pagedResult,
  type PagedResult,
  type PageRequest,
} from '../../src/shared/kernel/paged-result.js';

function matches(item: MediaItem, criteria: MediaCriteria): boolean {
  const { search, uploadedBy, kind, from, to } = criteria;
  const needle = search?.toLowerCase() ?? '';
  const filters: readonly (readonly [unknown, () => boolean])[] = [
    [
      search,
      () =>
        item.filename.toLowerCase().includes(needle) ||
        (item.altText?.toLowerCase().includes(needle) ?? false),
    ],
    [uploadedBy, () => item.uploadedBy === uploadedBy],
    [kind, () => item.mimeType.startsWith('image/') === (kind === 'image')],
    [from, () => item.createdAt >= (from as Date)],
    [to, () => item.createdAt <= (to as Date)],
  ];
  return filters.every(([filter, passes]) => filter === undefined || passes());
}

export class InMemoryMediaRepository implements MediaRepository {
  readonly items = new Map<string, MediaItem>();
  readonly pendingFileDeletions = new Set<string>();

  add(item: MediaItem): void {
    this.items.set(item.id, item);
  }

  get(id: string): MediaItem {
    const item = this.items.get(id);
    if (!item) throw new Error(`No media ${id}`);
    return item;
  }

  private withUploader(item: MediaItem): MediaWithUploader {
    return { item, uploaderName: `Name of ${item.uploadedBy}` };
  }

  findById(id: string): Promise<MediaItem | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }

  findByIds(ids: readonly string[]): Promise<readonly MediaItem[]> {
    return Promise.resolve(ids.flatMap((id) => this.items.get(id) ?? []));
  }

  findWithUploader(id: string): Promise<MediaWithUploader | null> {
    const item = this.items.get(id);
    return Promise.resolve(item ? this.withUploader(item) : null);
  }

  findMany(criteria: MediaCriteria, page: PageRequest): Promise<PagedResult<MediaWithUploader>> {
    const all = [...this.items.values()]
      .filter((item) => matches(item, criteria))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (page.page - 1) * page.pageSize;
    const rows = all.slice(start, start + page.pageSize).map((item) => this.withUploader(item));
    return Promise.resolve(pagedResult(rows, all.length, page));
  }

  findMimeTypes(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const found = ids.flatMap((id): [string, string][] => {
      const item = this.items.get(id.toLowerCase());
      return item ? [[item.id, item.mimeType]] : [];
    });
    return Promise.resolve(new Map(found));
  }

  create(item: MediaItem): Promise<void> {
    if (this.items.has(item.id)) return Promise.reject(new MediaAlreadyExistsError());
    this.items.set(item.id, item);
    return Promise.resolve();
  }

  updateMetadata(id: string, changes: Partial<MediaMetadata>): Promise<void> {
    this.items.set(id, MediaItem.restore({ ...this.get(id), ...changes }));
    return Promise.resolve();
  }

  saveVariants(id: string, result: VariantResult): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return Promise.resolve(false);
    const { status, ...fields } = result;
    this.items.set(id, MediaItem.restore({ ...item, ...fields, variantStatus: status }));
    return Promise.resolve(true);
  }

  delete(id: string): Promise<void> {
    this.items.delete(id);
    return Promise.resolve();
  }

  failPendingVariantsBefore(cutoff: Date): Promise<number> {
    let failed = 0;
    for (const item of this.items.values()) {
      if (item.variantStatus === 'pending' && item.createdAt < cutoff) {
        this.items.set(item.id, MediaItem.restore({ ...item, variantStatus: 'failed' }));
        failed += 1;
      }
    }
    return Promise.resolve(failed);
  }

  addPendingFileDeletions(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.pendingFileDeletions.add(key);
    return Promise.resolve();
  }

  findPendingFileDeletions(limit: number): Promise<readonly string[]> {
    return Promise.resolve([...this.pendingFileDeletions].slice(0, limit));
  }

  clearPendingFileDeletions(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.pendingFileDeletions.delete(key);
    return Promise.resolve();
  }

  findPendingVariants(createdBefore: Date, limit: number): Promise<readonly string[]> {
    const pending = [...this.items.values()].filter(
      (item) => item.variantStatus === 'pending' && item.createdAt < createdBefore,
    );
    return Promise.resolve(pending.slice(0, limit).map((item) => item.id));
  }
}

interface FakeObject {
  bytes: Uint8Array;
  contentType: string;
  etag: string;
  createdAt: Date;
}

export class InMemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, FakeObject>();
  readonly uploadRequests: UploadUrlRequest[] = [];
  private version = 0;
  now = new Date('2026-06-01T00:00:00Z');
  // Set to act as a second PUT arriving after the check and before the move.
  replaceBeforeCopy = false;

  private store(key: string, bytes: Uint8Array, contentType: string): void {
    this.version += 1;
    this.objects.set(key, {
      bytes,
      contentType,
      etag: `etag-${String(this.version)}`,
      createdAt: this.now,
    });
  }

  upload(key: string, bytes: Uint8Array, contentType: string): void {
    this.store(key, bytes, contentType);
  }

  uploadUrl(request: UploadUrlRequest): Promise<string> {
    this.uploadRequests.push(request);
    return Promise.resolve(`https://storage.test/upload/${request.key}`);
  }

  readUrl(request: ReadUrlRequest): Promise<string> {
    const disposition = request.attachment ? 'attachment' : 'inline';
    return Promise.resolve(
      `https://storage.test/${request.key}?d=${disposition}&ttl=${String(request.expiresInSeconds)}`,
    );
  }

  head(key: string): Promise<StoredObject | null> {
    const object = this.objects.get(key);
    return Promise.resolve(
      object
        ? { size: object.bytes.length, etag: object.etag, contentType: object.contentType }
        : null,
    );
  }

  read(key: string, request: ReadRequest): Promise<Uint8Array | null> {
    const object = this.objects.get(key);
    if (!object || (request.etag !== undefined && request.etag !== object.etag)) {
      return Promise.resolve(null);
    }
    return Promise.resolve(object.bytes.subarray(0, request.maxBytes));
  }

  copyIfUnchanged(from: string, to: string, etag: string): Promise<boolean> {
    const object = this.objects.get(from);
    if (this.replaceBeforeCopy || object?.etag !== etag) return Promise.resolve(false);
    this.store(to, object.bytes, object.contentType);
    return Promise.resolve(true);
  }

  put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.store(key, bytes, contentType);
    return Promise.resolve();
  }

  delete(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.objects.delete(key);
    return Promise.resolve();
  }

  deleteOlderThan(prefix: string, cutoff: Date): Promise<number> {
    let deleted = 0;
    for (const [key, object] of this.objects) {
      if (key.startsWith(prefix) && object.createdAt < cutoff) {
        this.objects.delete(key);
        deleted += 1;
      }
    }
    return Promise.resolve(deleted);
  }
}

// Removes scripts in any case, and repeats until nothing changes, so one removal cannot join the
// pieces of another. A bare "<script" with no end is removed too.
const SCRIPT = /<script\b[\s\S]*?<\/script[^>]*>|<script/gi;

export class FakeSvgSanitizer implements SvgSanitizer {
  sanitize(bytes: Uint8Array): Uint8Array | null {
    const text = Buffer.from(bytes).toString('utf8');
    if (text.includes('not-well-formed')) return null;
    let previous: string;
    let result = text;
    do {
      previous = result;
      result = result.replace(SCRIPT, '');
    } while (result !== previous);
    return Buffer.from(result);
  }
}

export class FakeImageProcessor implements ImageProcessor {
  result: ProcessedImage | null = {
    width: 2000,
    height: 1000,
    variants: [
      { name: 'thumbnail', bytes: Buffer.from('thumb'), width: 320, height: 160 },
      { name: 'medium', bytes: Buffer.from('medium'), width: 1024, height: 512 },
    ],
  };

  process(): Promise<ProcessedImage | null> {
    return Promise.resolve(this.result);
  }
}

export class RecordingVariantQueue implements MediaVariantQueue {
  readonly enqueued: string[] = [];

  enqueue(mediaId: string): Promise<void> {
    this.enqueued.push(mediaId);
    return Promise.resolve();
  }
}

export class FakeMediaUsageReader implements MediaUsageReader {
  readonly usage = new Map<string, number>();

  countUsage(mediaId: string): Promise<number> {
    return Promise.resolve(this.usage.get(mediaId) ?? 0);
  }
}
