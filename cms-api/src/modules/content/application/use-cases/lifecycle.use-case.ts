import type { Content } from '../../domain/entities/content.entity.js';
import type { ContentDeps } from '../content-deps.js';
import { assertCanModerate, assertCanSubmit } from '../policies/content.policy.js';
import type {
  ContentActionUseCase,
  ContentCommand,
  ContentView,
  DeleteContentUseCase,
  RejectContentUseCase,
  ScheduleContentUseCase,
} from '../ports/in/content.ports.js';
import { type ContentMutation, mutateContent, toContentView } from '../services/content-helpers.js';

const noDetails = () => ({});

function moderation(
  command: ContentCommand,
): Pick<ContentMutation, 'actor' | 'id' | 'ip' | 'authorize' | 'summary'> {
  const { actor, id, ip } = command;
  return {
    actor,
    id,
    ip,
    authorize: () => {
      assertCanModerate(actor);
    },
    summary: noDetails,
  };
}

export class SubmitContent implements ContentActionUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: ContentCommand): Promise<ContentView> {
    const { actor, id, ip } = command;
    const content = await mutateContent(this.deps, {
      actor,
      id,
      ip,
      action: 'content.submit',
      authorize: (current) => {
        assertCanSubmit(actor, current);
      },
      change: (current) => current.submit(this.deps.clock.now()),
      summary: noDetails,
    });
    return toContentView(content);
  }
}

export class PublishContent implements ContentActionUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: ContentCommand): Promise<ContentView> {
    const content = await mutateContent(this.deps, {
      ...moderation(command),
      action: 'content.publish',
      event: 'ContentPublished',
      change: (current) => current.publish(this.deps.clock.now()),
    });
    return toContentView(content);
  }
}

export class RejectContent implements RejectContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: ContentCommand & { readonly note: string }): Promise<ContentView> {
    const content = await mutateContent(this.deps, {
      ...moderation(command),
      action: 'content.reject',
      change: (current) => current.reject(command.note, this.deps.clock.now()),
      summary: (_before, after) => ({ note: after.reviewNote }),
    });
    return toContentView(content);
  }
}

export class UnpublishContent implements ContentActionUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: ContentCommand): Promise<ContentView> {
    const content = await mutateContent(this.deps, {
      ...moderation(command),
      action: 'content.unpublish',
      event: 'ContentUnpublished',
      change: (current) => current.unpublish(this.deps.clock.now()),
    });
    return toContentView(content);
  }
}

export class ArchiveContent implements ContentActionUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: ContentCommand): Promise<ContentView> {
    const content = await mutateContent(this.deps, {
      ...moderation(command),
      action: 'content.archive',
      change: (current) => current.archive(this.deps.clock.now()),
    });
    return toContentView(content);
  }
}

export class ScheduleContent implements ScheduleContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(
    command: ContentCommand & { readonly scheduledAt: Date | null },
  ): Promise<ContentView> {
    const { scheduledAt } = command;
    const content = await mutateContent(this.deps, {
      ...moderation(command),
      action: scheduledAt === null ? 'content.schedule_cancel' : 'content.schedule',
      change: (current) => this.change(current, scheduledAt),
      summary: () => (scheduledAt === null ? {} : { scheduled_at: scheduledAt.toISOString() }),
    });
    return toContentView(content);
  }

  private change(current: Content, scheduledAt: Date | null): Content {
    const now = this.deps.clock.now();
    if (scheduledAt !== null) return current.schedule(scheduledAt, now);
    return current.scheduledAt === null ? current : current.cancelSchedule(now);
  }
}

export class DeleteContent implements DeleteContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: ContentCommand): Promise<void> {
    await mutateContent(this.deps, {
      ...moderation(command),
      action: 'content.delete',
      event: 'ContentDeleted',
      change: (current) => current.softDelete(this.deps.clock.now()),
    });
  }
}
