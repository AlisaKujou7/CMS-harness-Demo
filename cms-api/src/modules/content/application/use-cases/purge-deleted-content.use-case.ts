import type { ContentDeps } from '../content-deps.js';
import type { PurgeDeletedContentUseCase } from '../ports/in/content.ports.js';

const RETENTION_MS = 30 * 86_400_000;
const BATCH_SIZE = 100;

// FR-CONTENT-13. Each batch is its own transaction, because one large delete could outlast the
// transaction timeout, roll back, and leave the next run with even more to do.
export class PurgeDeletedContent implements PurgeDeletedContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(): Promise<number> {
    const cutoff = new Date(this.deps.clock.now().getTime() - RETENTION_MS);
    let total = 0;
    let purged: number;
    do {
      purged = await this.purgeBatch(cutoff);
      total += purged;
    } while (purged === BATCH_SIZE);
    return total;
  }

  private purgeBatch(cutoff: Date): Promise<number> {
    return this.deps.tx.run(async () => {
      const ids = await this.deps.contents.purgeDeletedBefore(cutoff, BATCH_SIZE);
      if (ids.length > 0) {
        await this.deps.audit.record({
          actorId: null,
          actorIp: null,
          action: 'content.purge',
          targetType: 'content',
          targetId: null,
          summary: { count: ids.length, ids },
        });
      }
      return ids.length;
    });
  }
}
