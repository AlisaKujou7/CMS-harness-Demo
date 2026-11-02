import type { DomainEventPublisher } from '../../../shared/ports/event-publisher.port.js';
import type {
  AuditLog,
  Clock,
  IdGenerator,
  Logger,
  TransactionRunner,
} from '../../../shared/ports/system.port.js';
import type { ContentRepository } from './ports/out/content-repository.port.js';

export interface ContentDeps {
  readonly contents: ContentRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly tx: TransactionRunner;
  readonly audit: AuditLog;
  readonly events: DomainEventPublisher;
  readonly logger: Logger;
  readonly contentCategories: readonly string[];
}
