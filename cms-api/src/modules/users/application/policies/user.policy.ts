import { canManageSystem, type Actor } from '../../../../shared/kernel/actor.js';
import { ForbiddenError } from '../../../../shared/kernel/app-error.js';

export function assertCanManageUsers(actor: Actor): void {
  if (!canManageSystem(actor)) throw new ForbiddenError();
}
