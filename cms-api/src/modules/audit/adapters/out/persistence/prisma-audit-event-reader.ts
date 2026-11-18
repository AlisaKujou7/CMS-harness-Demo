import type { Prisma } from '../../../../../generated/prisma/client.js';
import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import {
  pagedResult,
  type PagedResult,
  type PageRequest,
} from '../../../../../shared/kernel/paged-result.js';
import type {
  AuditCriteria,
  AuditEventReader,
  AuditEventView,
} from '../../../application/ports/out/audit-reader.port.js';

const NEWEST_FIRST = [{ occurredAt: 'desc' }, { id: 'desc' }] as const;

function toWhere(criteria: AuditCriteria): Prisma.AuditEventWhereInput {
  return {
    ...(criteria.actorId === undefined ? {} : { actorId: criteria.actorId }),
    ...(criteria.action === undefined ? {} : { action: criteria.action }),
    ...(criteria.targetType === undefined ? {} : { targetType: criteria.targetType }),
    ...(criteria.targetId === undefined ? {} : { targetId: criteria.targetId }),
    occurredAt: {
      ...(criteria.from === undefined ? {} : { gte: criteria.from }),
      ...(criteria.to === undefined ? {} : { lte: criteria.to }),
    },
  };
}

export class PrismaAuditEventReader implements AuditEventReader {
  constructor(private readonly db: PrismaContext) {}

  async list(criteria: AuditCriteria, page: PageRequest): Promise<PagedResult<AuditEventView>> {
    const where = toWhere(criteria);
    const [rows, total] = await Promise.all([
      this.db.client.auditEvent.findMany({
        where,
        orderBy: [...NEWEST_FIRST],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.db.client.auditEvent.count({ where }),
    ]);
    return pagedResult(rows, total, page);
  }

  batchAfter(
    criteria: AuditCriteria,
    afterId: string | null,
    limit: number,
  ): Promise<readonly AuditEventView[]> {
    return this.db.client.auditEvent.findMany({
      where: toWhere(criteria),
      orderBy: [...NEWEST_FIRST],
      take: limit,
      ...(afterId === null ? {} : { cursor: { id: afterId }, skip: 1 }),
    });
  }
}
