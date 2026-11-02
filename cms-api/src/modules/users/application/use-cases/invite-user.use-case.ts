import type { Actor, UserRole } from '../../../../shared/kernel/actor.js';
import { Email } from '../../../../shared/kernel/email.js';
import { User } from '../../domain/entities/user.entity.js';
import type { UserInvited } from '../../domain/events/user.events.js';
import { assertCanManageUsers } from '../policies/user.policy.js';
import type { InviteUserUseCase, UserSummary } from '../ports/in/users.ports.js';
import { toUserSummary } from '../services/user-helpers.js';
import type { UsersDeps } from '../users-deps.js';

export class InviteUser implements InviteUserUseCase {
  constructor(private readonly deps: UsersDeps) {}

  async execute(command: {
    readonly actor: Actor;
    readonly email: string;
    readonly name?: string;
    readonly role: UserRole;
    readonly ip: string | null;
  }): Promise<UserSummary> {
    assertCanManageUsers(command.actor);

    const user = User.invite({
      id: this.deps.ids.next(),
      email: Email.create(command.email),
      role: command.role,
      now: this.deps.clock.now(),
      ...(command.name === undefined ? {} : { name: command.name }),
    });
    await this.deps.tx.run(async () => {
      await this.deps.users.save(user);
      await this.deps.audit.record({
        actorId: command.actor.id,
        actorIp: command.ip,
        action: 'user.create',
        targetType: 'user',
        targetId: user.id,
        summary: { role: user.role },
      });
    });

    const event: UserInvited = { type: 'UserInvited', userId: user.id, email: user.email };
    await this.deps.events.publishAll([event]);
    return toUserSummary(user);
  }
}
