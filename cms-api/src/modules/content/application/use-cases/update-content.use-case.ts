import type { Content } from '../../domain/entities/content.entity.js';
import { ConcurrentModificationError } from '../../domain/errors/content.errors.js';
import type { ContentDeps } from '../content-deps.js';
import { assertCanEdit } from '../policies/content.policy.js';
import type {
  ContentView,
  UpdateContentCommand,
  UpdateContentUseCase,
} from '../ports/in/content.ports.js';
import {
  assertValidReferences,
  mutateContent,
  sanitizedFields,
  toContentView,
  toSnapshot,
} from '../services/content-helpers.js';

function changedFieldNames(before: Content, after: Content): string[] {
  const old = toSnapshot(before);
  const updated = toSnapshot(after);
  return (Object.keys(updated) as (keyof typeof updated)[]).filter(
    (field) => field !== 'status' && JSON.stringify(old[field]) !== JSON.stringify(updated[field]),
  );
}

export class UpdateContent implements UpdateContentUseCase {
  constructor(private readonly deps: ContentDeps) {}

  async execute(command: UpdateContentCommand): Promise<ContentView> {
    const { actor, id, ip, version, ...patch } = command;
    const changes = sanitizedFields(patch);
    const content = await mutateContent(this.deps, {
      actor,
      id,
      ip,
      action: 'content.update',
      authorize: (current) => {
        assertCanEdit(actor, current);
        if (current.version !== version) throw new ConcurrentModificationError();
      },
      change: async (current) => {
        await assertValidReferences(this.deps, current, changes);
        const edited = current.edit(changes, this.deps.clock.now());
        return changedFieldNames(current, edited).length === 0 ? current : edited;
      },
      summary: (before, after) => ({ fields: changedFieldNames(before, after) }),
    });
    return toContentView(content);
  }
}
