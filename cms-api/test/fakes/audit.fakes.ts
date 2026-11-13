import type {
  AuditCriteria,
  AuditEventReader,
  AuditEventView,
} from '../../src/modules/audit/application/ports/out/audit-reader.port.js';
import {
  pagedResult,
  type PagedResult,
  type PageRequest,
} from '../../src/shared/kernel/paged-result.js';

function matches(event: AuditEventView, criteria: AuditCriteria): boolean {
  const { from, to, ...exact } = criteria;
  const exactMatch = Object.entries(exact).every(
    ([field, value]) => event[field as keyof typeof exact] === value,
  );
  return exactMatch && (!from || event.occurredAt >= from) && (!to || event.occurredAt <= to);
}

export class InMemoryAuditEventReader implements AuditEventReader {
  readonly events: AuditEventView[] = [];

  private selected(criteria: AuditCriteria): AuditEventView[] {
    return this.events.filter((event) => matches(event, criteria));
  }

  list(criteria: AuditCriteria, page: PageRequest): Promise<PagedResult<AuditEventView>> {
    const all = this.selected(criteria);
    const start = (page.page - 1) * page.pageSize;
    return Promise.resolve(pagedResult(all.slice(start, start + page.pageSize), all.length, page));
  }

  batchAfter(
    criteria: AuditCriteria,
    afterId: string | null,
    limit: number,
  ): Promise<readonly AuditEventView[]> {
    const all = this.selected(criteria);
    const start = afterId === null ? 0 : all.findIndex((event) => event.id === afterId) + 1;
    return Promise.resolve(all.slice(start, start + limit));
  }
}
