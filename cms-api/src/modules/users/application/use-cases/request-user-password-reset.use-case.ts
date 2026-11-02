import type { UserPasswordResetRequested } from '../../domain/events/user.events.js';
import { assertCanManageUsers } from '../policies/user.policy.js';
import type { UserActionUseCase, UserCommand } from '../ports/in/users.ports.js';
import { loadUser } from '../services/user-helpers.js';
import type { UsersDeps } from '../users-deps.js';

// UR-A05: an Admin sends the owner a reset link. The Admin never sees or sets the password.
export class RequestUserPasswordReset implements UserActionUseCase {
  constructor(private readonly deps: UsersDeps) {}

  async execute(command: UserCommand): Promise<void> {
    assertCanManageUsers(command.actor);

    const user = await loadUser(this.deps.users, command.id);
    await this.deps.audit.record({
      actorId: command.actor.id,
      actorIp: command.ip,
      action: 'user.password_reset_requested',
      targetType: 'user',
      targetId: user.id,
      summary: {},
    });
    const event: UserPasswordResetRequested = {
      type: 'UserPasswordResetRequested',
      email: user.email,
      ip: command.ip,
    };
    await this.deps.events.publishAll([event]);
  }
}
