import { UserNotInvitedError } from '../../domain/errors/user.errors.js';
import type { UserInvited } from '../../domain/events/user.events.js';
import { assertCanManageUsers } from '../policies/user.policy.js';
import type { UserActionUseCase, UserCommand } from '../ports/in/users.ports.js';
import { loadUser } from '../services/user-helpers.js';
import type { UsersDeps } from '../users-deps.js';

export class ResendInvitation implements UserActionUseCase {
  constructor(private readonly deps: UsersDeps) {}

  async execute(command: UserCommand): Promise<void> {
    assertCanManageUsers(command.actor);

    const user = await loadUser(this.deps.users, command.id);
    if (!user.isInvited()) throw new UserNotInvitedError();

    await this.deps.audit.record({
      actorId: command.actor.id,
      actorIp: command.ip,
      action: 'user.invitation_resent',
      targetType: 'user',
      targetId: user.id,
      summary: {},
    });
    const event: UserInvited = { type: 'UserInvited', userId: user.id, email: user.email };
    await this.deps.events.publishAll([event]);
  }
}
