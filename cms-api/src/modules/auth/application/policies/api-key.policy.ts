import { canManageSystem, type Actor } from '../../../../shared/kernel/actor.js';
import { ForbiddenError } from '../../../../shared/kernel/app-error.js';

export function assertCanManageApiKeys(actor: Actor): void {
  if (!canManageSystem(actor)) throw new ForbiddenError();
}
