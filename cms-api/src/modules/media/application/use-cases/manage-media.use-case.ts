import { defined } from '../../../../shared/kernel/defined.js';
import type { MediaDeleted } from '../../domain/events/media.events.js';
import { MediaInUseError } from '../../domain/errors/media.errors.js';
import type { MediaDeps } from '../media-deps.js';
import { assertCanForceDelete, assertCanManage } from '../policies/media.policy.js';
import type {
  DeleteMediaUseCase,
  MediaCommand,
  MediaView,
  UpdateMediaCommand,
  UpdateMediaUseCase,
} from '../ports/in/media.ports.js';
import { loadMedia, toMediaView } from '../services/media-helpers.js';

export class UpdateMedia implements UpdateMediaUseCase {
  constructor(private readonly deps: MediaDeps) {}

  async execute(command: UpdateMediaCommand): Promise<MediaView> {
    const { actor, id, ip, altText, caption } = command;
    const updated = await this.deps.tx.run(async () => {
      const item = await loadMedia(this.deps.media, id);
      assertCanManage(actor, item);
      const after = item.withMetadata(defined({ altText, caption }));
      const changes = defined({
        altText: after.altText === item.altText ? undefined : after.altText,
        caption: after.caption === item.caption ? undefined : after.caption,
      });
      if (Object.keys(changes).length === 0) return item;

      await this.deps.media.updateMetadata(id, changes);
      await this.deps.audit.record({
        actorId: actor.id,
        actorIp: ip,
        action: 'media.update',
        targetType: 'media',
        targetId: id,
        summary: { fields: Object.keys(changes) },
      });
      return after;
    });
    return toMediaView(this.deps, updated);
  }
}

export class DeleteMedia implements DeleteMediaUseCase {
  constructor(private readonly deps: MediaDeps) {}

  async execute(command: MediaCommand & { readonly force: boolean }): Promise<void> {
    const { actor, id, ip, force } = command;
    if (force) assertCanForceDelete(actor);
    const item = await this.deps.tx.run(async () => {
      const found = await loadMedia(this.deps.media, id);
      assertCanManage(actor, found);
      const usageCount = await this.deps.usage.countUsage(id);
      if (usageCount > 0 && !force) throw new MediaInUseError(usageCount);

      await this.deps.media.delete(id);
      await this.deps.audit.record({
        actorId: actor.id,
        actorIp: ip,
        action: 'media.delete',
        targetType: 'media',
        targetId: id,
        summary: { filename: found.filename, forced: force, usage_count: usageCount },
      });
      return found;
    });
    // After the commit, so a rollback never leaves a record whose file is gone.
    await this.deps.storage.delete(item.storedKeys());
    const event: MediaDeleted = { type: 'MediaDeleted', mediaId: id };
    await this.deps.events.publishAll([event]);
  }
}
