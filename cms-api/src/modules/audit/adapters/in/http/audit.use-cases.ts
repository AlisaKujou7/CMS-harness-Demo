import type {
  ExportAuditEventsUseCase,
  ListAuditEventsUseCase,
} from '../../../application/ports/in/audit.ports.js';

export const AUDIT_USE_CASES = Symbol('AuditUseCases');

export interface AuditUseCases {
  readonly list: ListAuditEventsUseCase;
  readonly export: ExportAuditEventsUseCase;
}
