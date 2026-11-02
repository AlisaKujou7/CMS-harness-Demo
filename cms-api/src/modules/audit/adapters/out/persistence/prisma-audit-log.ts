import type { Prisma } from '../../../../../generated/prisma/client.js';
import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import type {
  AuditEventInput,
  AuditLog,
  Clock,
  IdGenerator,
} from '../../../../../shared/ports/system.port.js';

export class PrismaAuditLog implements AuditLog {
  constructor(
    private readonly db: PrismaContext,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async record(event: AuditEventInput): Promise<void> {
    await this.db.client.auditEvent.create({
      data: {
        ...event,
        id: this.ids.next(),
        occurredAt: this.clock.now(),
        summary: event.summary as Prisma.InputJsonObject,
      },
    });
  }
}
