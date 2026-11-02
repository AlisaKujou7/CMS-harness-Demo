import type { Actor } from '../../../../shared/kernel/actor.js';
import type { AuditLog } from '../../../../shared/ports/system.port.js';
import { assertCanReadAudit } from '../policies/audit.policy.js';
import type { ExportAuditEventsUseCase } from '../ports/in/audit.ports.js';
import type {
  AuditCriteria,
  AuditEventReader,
  AuditEventView,
} from '../ports/out/audit-reader.port.js';

export const EXPORT_BATCH_SIZE = 500;

export class ExportAuditEvents implements ExportAuditEventsUseCase {
  constructor(
    private readonly deps: { readonly reader: AuditEventReader; readonly audit: AuditLog },
  ) {}

  async execute(command: {
    readonly actor: Actor;
    readonly criteria: AuditCriteria;
    readonly ip: string | null;
  }): Promise<AsyncIterable<AuditEventView>> {
    assertCanReadAudit(command.actor);
    await this.deps.audit.record({
      actorId: command.actor.id,
      actorIp: command.ip,
      action: 'audit.export',
      targetType: null,
      targetId: null,
      summary: { criteria: JSON.parse(JSON.stringify(command.criteria)) as unknown },
    });
    return this.batches(command.criteria);
  }

  // Reads in batches, because the log can hold millions of rows (02-SRS 6.3).
  private async *batches(criteria: AuditCriteria): AsyncGenerator<AuditEventView> {
    let afterId: string | null = null;
    for (;;) {
      const batch: readonly AuditEventView[] = await this.deps.reader.batchAfter(
        criteria,
        afterId,
        EXPORT_BATCH_SIZE,
      );
      yield* batch;
      const last = batch.at(-1);
      if (!last || batch.length < EXPORT_BATCH_SIZE) return;
      afterId = last.id;
    }
  }
}
