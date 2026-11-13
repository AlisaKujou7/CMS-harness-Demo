import type { DomainEventPublisher } from '../../../shared/ports/event-publisher.port.js';
import type {
  AuditLog,
  Clock,
  IdGenerator,
  Logger,
  TransactionRunner,
} from '../../../shared/ports/system.port.js';
import type { MediaRepository } from './ports/out/media-repository.port.js';
import type {
  ImageProcessor,
  MediaUsageReader,
  MediaVariantQueue,
  ObjectStorage,
  SvgSanitizer,
} from './ports/out/media-services.port.js';

export interface MediaConfig {
  readonly maxUploadBytes: number;
  readonly uploadUrlTtlSeconds: number;
  readonly readUrlTtlSeconds: number;
}

export interface MediaDeps {
  readonly media: MediaRepository;
  readonly storage: ObjectStorage;
  readonly svg: SvgSanitizer;
  readonly images: ImageProcessor;
  readonly variantQueue: MediaVariantQueue;
  readonly usage: MediaUsageReader;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly tx: TransactionRunner;
  readonly audit: AuditLog;
  readonly events: DomainEventPublisher;
  readonly logger: Logger;
  readonly mediaConfig: MediaConfig;
}
