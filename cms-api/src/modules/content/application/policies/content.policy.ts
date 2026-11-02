import type { Actor } from '../../../../shared/kernel/actor.js';
import { ForbiddenError } from '../../../../shared/kernel/app-error.js';
import type { Content } from '../../domain/entities/content.entity.js';
import {
  ContentScheduledError,
  InvalidTransitionError,
} from '../../domain/errors/content.errors.js';

// 02-SRS 5.3.1. The routes check roles too, so this is the second of the two layers FR-AUTHZ-01
// asks for, and the one that knows who owns what.
export function seesAllContent(actor: Actor): boolean {
  return actor.role !== 'author';
}

function assertOwnerOrModerator(actor: Actor, content: Content): void {
  if (!seesAllContent(actor) && content.authorId !== actor.id) throw new ForbiddenError();
}

export function assertCanModerate(actor: Actor): void {
  if (!seesAllContent(actor)) throw new ForbiddenError();
}

export function assertCanRead(actor: Actor, content: Content): void {
  if (content.status !== 'published') assertOwnerOrModerator(actor, content);
}

// History holds earlier drafts, so a published item being readable does not open its versions.
export function assertCanReadHistory(actor: Actor, content: Content): void {
  assertOwnerOrModerator(actor, content);
}

export function assertCanSubmit(actor: Actor, content: Content): void {
  assertOwnerOrModerator(actor, content);
}

// Once submitted or live, an author's content is in the hands of Editors until it comes back.
export function assertCanEdit(actor: Actor, content: Content): void {
  assertOwnerOrModerator(actor, content);
  if (!seesAllContent(actor) && content.scheduledAt !== null) throw new ContentScheduledError();
  if (
    !seesAllContent(actor) &&
    (content.status === 'in_review' || content.status === 'published')
  ) {
    throw new InvalidTransitionError(content.status, 'draft');
  }
}
