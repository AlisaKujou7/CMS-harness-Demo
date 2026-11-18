import { canManageSystem, type Actor } from '../../../../shared/kernel/actor.js';
import { ForbiddenError } from '../../../../shared/kernel/app-error.js';
import type { MediaItem } from '../../domain/entities/media-item.entity.js';

// 02-SRS 5.3.1: Authors manage what they uploaded, Editors and Admins manage the whole library.
export function assertCanManage(actor: Actor, item: MediaItem): void {
  if (actor.role === 'author' && item.uploadedBy !== actor.id) throw new ForbiddenError();
}

// FR-MEDIA-07.
export function assertCanForceDelete(actor: Actor): void {
  if (!canManageSystem(actor)) throw new ForbiddenError();
}
