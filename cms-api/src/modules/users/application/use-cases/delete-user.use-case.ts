import { assertCanManageUsers } from '../policies/user.policy.js';
import type { UserActionUseCase, UserCommand } from '../ports/in/users.ports.js';
import { assertAnotherAdminRemains, loadUser } from '../services/user-helpers.js';
import type { UsersDeps } from '../users-deps.js';

export class DeleteUser implements UserActionUseCase {
  constructor(private readonly deps: UsersDeps) {}

  async execute(command: UserCommand): Promise<void> {
    assertCanManageUsers(command.actor);

    await this.deps.tx.run(async () => {
      const user = await loadUser(this.deps.users, command.id);
      await assertAnotherAdminRemains(this.deps.users, user);
      await this.deps.users.delete(user.id);
      await this.deps.audit.record({
        actorId: command.actor.id,
        actorIp: command.ip,
        action: 'user.delete',
        targetType: 'user',
        targetId: user.id,
        summary: {},
      });
    });
  }
}
