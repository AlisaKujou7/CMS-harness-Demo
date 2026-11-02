import type { PagedResult, PageRequest } from '../../../../../shared/kernel/paged-result.js';

export interface AuditEventView {
  readonly id: string;
  readonly occurredAt: Date;
  readonly actorId: string | null;
  readonly actorIp: string | null;
  readonly action: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly summary: unknown;
}

export interface AuditCriteria {
  readonly actorId?: string;
  readonly action?: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

// Reads newest first. There is deliberately no write here: see AuditLog.
export interface AuditEventReader {
  list(criteria: AuditCriteria, page: PageRequest): Promise<PagedResult<AuditEventView>>;
  batchAfter(
    criteria: AuditCriteria,
    afterId: string | null,
    limit: number,
  ): Promise<readonly AuditEventView[]>;
}
