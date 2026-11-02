import type { ContentDeps } from '../content-deps.js';
import type { PurgeDeletedContentUseCase } from '../ports/in/content.ports.js';

const RETENTION_MS = 30 * 86_400_000;

// FR-CONTENT-13.
export class PurgeDeletedContent implements PurgeDeletedContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  execute(): Promise<number> {
    return this.deps.tx.run(async () => {
      const cutoff = new Date(this.deps.clock.now().getTime() - RETENTION_MS);
      const count = await this.deps.contents.purgeDeletedBefore(cutoff);
      if (count > 0) {
        await this.deps.audit.record({
          actorId: null,
          actorIp: null,
          action: 'content.purge',
          targetType: 'content',
          targetId: null,
          summary: { count },
        });
      }
      return count;
    });
  }
}
