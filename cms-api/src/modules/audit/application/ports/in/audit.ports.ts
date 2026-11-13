import type { Actor } from '../../../../../shared/kernel/actor.js';
import type { PagedResult } from '../../../../../shared/kernel/paged-result.js';
import type { AuditCriteria, AuditEventView } from '../out/audit-reader.port.js';

export interface ListAuditEventsUseCase {
  execute(command: {
    readonly actor: Actor;
    readonly criteria: AuditCriteria;
    readonly page?: number;
    readonly pageSize?: number;
  }): Promise<PagedResult<AuditEventView>>;
}

export interface ExportAuditEventsUseCase {
  execute(command: {
    readonly actor: Actor;
    readonly criteria: AuditCriteria;
    readonly ip: string | null;
  }): Promise<AsyncIterable<AuditEventView>>;
}
