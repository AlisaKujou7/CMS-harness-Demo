import type { MediaVariants } from '../../domain/entities/media-item.entity.js';
import { variantKey } from '../../domain/services/media-types.js';
import type { MediaDeps } from '../media-deps.js';
import type {
  EnqueueMissingVariantsUseCase,
  GenerateMediaVariantsUseCase,
  PurgeAbandonedUploadsUseCase,
} from '../ports/in/media.ports.js';
import type { ProcessedImage } from '../ports/out/media-services.port.js';

const VARIANT_CONTENT_TYPE = 'image/webp';
const PENDING_GRACE_MS = 2 * 60_000;
const SWEEP_LIMIT = 100;
const ABANDONED_AFTER_MS = 86_400_000;

// FR-MEDIA-05.
export class GenerateMediaVariants implements GenerateMediaVariantsUseCase {
  constructor(private readonly deps: MediaDeps) {}

  async execute(mediaId: string): Promise<void> {
    const { media, storage, images, logger, mediaConfig } = this.deps;
    const item = await media.findById(mediaId);
    if (item?.variantStatus !== 'pending') return;

    const bytes = await storage.read(item.storageKey, { maxBytes: mediaConfig.maxUploadBytes });
    if (!bytes) throw new Error(`Media ${mediaId} has no stored file`);
    const processed = await images.process(bytes);
    if (!processed) {
      logger.error('Could not create media variants', { mediaId });
      await media.saveVariants(mediaId, {
        width: null,
        height: null,
        variants: {},
        status: 'failed',
      });
      return;
    }
    await this.store(mediaId, processed);
  }

  private async store(mediaId: string, processed: ProcessedImage): Promise<void> {
    const { media, storage } = this.deps;
    const entries = await Promise.all(
      processed.variants.map(async ({ name, bytes, width, height }) => {
        const key = variantKey(mediaId, name);
        await storage.put(key, bytes, VARIANT_CONTENT_TYPE);
        return [name, { key, width, height }] as const;
      }),
    );
    const variants: MediaVariants = Object.fromEntries(entries);
    const saved = await media.saveVariants(mediaId, {
      width: processed.width,
      height: processed.height,
      variants,
      status: 'ready',
    });
    // Deleted while this ran, and nothing else would ever remove these.
    if (!saved) await storage.delete(entries.map(([, variant]) => variant.key));
  }
}

// The queue is not transactional with the database, so a job can be lost. Variants are derived from
// the original, so asking again is always safe.
export class EnqueueMissingVariants implements EnqueueMissingVariantsUseCase {
  constructor(private readonly deps: MediaDeps) {}

  async execute(): Promise<number> {
    const before = new Date(this.deps.clock.now().getTime() - PENDING_GRACE_MS);
    const pending = await this.deps.media.findPendingVariants(before, SWEEP_LIMIT);
    await Promise.all(pending.map((id) => this.deps.variantQueue.enqueue(id)));
    return pending.length;
  }
}

// RK-03: a presigned upload that is never finalized would otherwise be stored and paid for forever.
export class PurgeAbandonedUploads implements PurgeAbandonedUploadsUseCase {
  constructor(private readonly deps: MediaDeps) {}

  execute(): Promise<number> {
    const cutoff = new Date(this.deps.clock.now().getTime() - ABANDONED_AFTER_MS);
    return this.deps.storage.deleteOlderThan('uploads/', cutoff);
  }
}
