import type { AppError } from '../../../../shared/kernel/app-error.js';
import type { Content } from '../../domain/entities/content.entity.js';
import {
  ConcurrentModificationError,
  InvalidTransitionError,
  MissingRequiredFieldsError,
} from '../../domain/errors/content.errors.js';
import type { ContentDeps } from '../content-deps.js';
import type { PublishDueContentUseCase } from '../ports/in/content.ports.js';
import { publishContentEvent, recordChange } from '../services/content-helpers.js';

const BATCH_SIZE = 100;

function cannotPublish(error: unknown): error is AppError {
  return error instanceof MissingRequiredFieldsError || error instanceof InvalidTransitionError;
}

// FR-CONTENT-07. Each item commits alone, so one bad item cannot hold back the rest. The version
// check in save means two workers cannot both publish the same item.
export class PublishDueContent implements PublishDueContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(): Promise<number> {
    const now = this.deps.clock.now();
    const due = await this.deps.contents.findDueForPublish(now, BATCH_SIZE);
    let published = 0;
    for (const id of due) {
      if (await this.publishOne(id, now)) published += 1;
    }
    return published;
  }

  private async publishOne(id: string, now: Date): Promise<boolean> {
    try {
      const content = await this.deps.tx.run(() => this.apply(id, now));
      if (!content) return false;
      await publishContentEvent(this.deps, 'ContentPublished', content);
      return true;
    } catch (error) {
      // Someone saved first. If it is still due, the next tick picks it up.
      if (!(error instanceof ConcurrentModificationError)) {
        this.deps.logger.error('Scheduled publish failed', {
          contentId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return false;
    }
  }

  private async apply(id: string, now: Date): Promise<Content | null> {
    const content = await this.deps.contents.findById(id);
    if (content?.scheduledAt == null || content.scheduledAt > now) return null;

    let published: Content;
    try {
      published = content.publish(now);
    } catch (error) {
      if (!cannotPublish(error)) throw error;
      await this.clearSchedule(content, now, error);
      return null;
    }
    await this.deps.contents.save(published);
    await recordChange(this.deps, published, {
      actorId: null,
      ip: null,
      action: 'content.publish',
      summary: { scheduled: true },
    });
    return published;
  }

  // Trying again every tick would never succeed, so the schedule ends and the audit log says why.
  private async clearSchedule(content: Content, now: Date, error: AppError): Promise<void> {
    const cleared = content.cancelSchedule(now);
    await this.deps.contents.save(cleared);
    await recordChange(this.deps, cleared, {
      actorId: null,
      ip: null,
      action: 'content.schedule_failed',
      summary: { code: error.code, details: error.details },
    });
  }
}
