import type { PagedResult, PageRequest } from '../../../../../shared/kernel/paged-result.js';
import type {
  MediaItem,
  MediaMetadata,
  MediaVariants,
  VariantStatus,
} from '../../../domain/entities/media-item.entity.js';

// FR-MEDIA-08, plus the type filter from 03-DESIGN 12.5.
export interface MediaCriteria {
  readonly search?: string;
  readonly uploadedBy?: string;
  readonly kind?: 'image' | 'document';
  readonly from?: Date;
  readonly to?: Date;
}

export interface MediaWithUploader {
  readonly item: MediaItem;
  readonly uploaderName: string;
}

export interface VariantResult {
  readonly width: number | null;
  readonly height: number | null;
  readonly variants: MediaVariants;
  readonly status: VariantStatus;
}

export interface MediaRepository {
  findById(id: string): Promise<MediaItem | null>;
  findByIds(ids: readonly string[]): Promise<readonly MediaItem[]>;
  findWithUploader(id: string): Promise<MediaWithUploader | null>;
  // Newest first.
  findMany(criteria: MediaCriteria, page: PageRequest): Promise<PagedResult<MediaWithUploader>>;
  // The type of each id that exists, keyed by the id in lowercase, as PostgreSQL returns it.
  findMimeTypes(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;
  // Throws MediaAlreadyExistsError when this upload was already finalized.
  create(item: MediaItem): Promise<void>;
  // Writes only the metadata, so it cannot undo variants the worker saved meanwhile.
  updateMetadata(id: string, changes: Partial<MediaMetadata>): Promise<void>;
  // Returns false when the item is gone, so the caller can remove what it just stored.
  saveVariants(id: string, result: VariantResult): Promise<boolean>;
  delete(id: string): Promise<void>;
  findPendingVariants(createdBefore: Date, limit: number): Promise<readonly string[]>;
  // Ends the wait for variants that were never made. Returns how many.
  failPendingVariantsBefore(cutoff: Date): Promise<number>;
  // Files owed a deletion. Written with the delete itself, so a storage outage cannot lose track.
  addPendingFileDeletions(keys: readonly string[], at: Date): Promise<void>;
  findPendingFileDeletions(limit: number): Promise<readonly string[]>;
  clearPendingFileDeletions(keys: readonly string[]): Promise<void>;
}
