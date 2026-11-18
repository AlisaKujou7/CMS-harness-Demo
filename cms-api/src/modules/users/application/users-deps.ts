import type { DomainEventPublisher } from '../../../shared/ports/event-publisher.port.js';
import type {
  AuditLog,
  Clock,
  IdGenerator,
  TransactionRunner,
} from '../../../shared/ports/system.port.js';
import type { UserRepository } from './ports/out/user-repository.port.js';

export interface UsersDeps {
  readonly users: UserRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly tx: TransactionRunner;
  readonly audit: AuditLog;
  readonly events: DomainEventPublisher;
}
