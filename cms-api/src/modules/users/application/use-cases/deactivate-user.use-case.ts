import type { UserDeactivated } from '../../domain/events/user.events.js';
import { assertCanManageUsers } from '../policies/user.policy.js';
import type { UserActionUseCase, UserCommand } from '../ports/in/users.ports.js';
import { assertAnotherAdminRemains, loadUser } from '../services/user-helpers.js';
import type { UsersDeps } from '../users-deps.js';

export class DeactivateUser implements UserActionUseCase {
  constructor(private readonly deps: UsersDeps) {}

  async execute(command: UserCommand): Promise<void> {
    assertCanManageUsers(command.actor);

    const changed = await this.deps.tx.run(() => this.deactivate(command));
    if (!changed) return;

    const event: UserDeactivated = { type: 'UserDeactivated', userId: command.id };
    await this.deps.events.publishAll([event]);
  }

  private async deactivate(command: UserCommand): Promise<boolean> {
    const user = await loadUser(this.deps.users, command.id);
    if (user.isDeactivated()) return false;

    await assertAnotherAdminRemains(this.deps.users, user);
    const { status, updatedAt } = user.deactivate(this.deps.clock.now());
    await this.deps.users.update(user.id, { status, updatedAt });
    await this.deps.audit.record({
      actorId: command.actor.id,
      actorIp: command.ip,
      action: 'user.deactivate',
      targetType: 'user',
      targetId: user.id,
      summary: {},
    });
    return true;
  }
}
