import type { Actor } from '../../../../shared/kernel/actor.js';
import { type PagedResult, toPageRequest } from '../../../../shared/kernel/paged-result.js';
import { assertCanReadAudit } from '../policies/audit.policy.js';
import type { ListAuditEventsUseCase } from '../ports/in/audit.ports.js';
import type {
  AuditCriteria,
  AuditEventReader,
  AuditEventView,
} from '../ports/out/audit-reader.port.js';

export class ListAuditEvents implements ListAuditEventsUseCase {
  constructor(private readonly deps: { readonly reader: AuditEventReader }) {}

  async execute(command: {
    readonly actor: Actor;
    readonly criteria: AuditCriteria;
    readonly page?: number;
    readonly pageSize?: number;
  }): Promise<PagedResult<AuditEventView>> {
    assertCanReadAudit(command.actor);
    return this.deps.reader.list(command.criteria, toPageRequest(command));
  }
}
