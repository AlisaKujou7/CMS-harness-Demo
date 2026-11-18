import type { UserRole } from '../../../../shared/kernel/actor.js';
import type { User } from '../../domain/entities/user.entity.js';
import { assertCanManageUsers } from '../policies/user.policy.js';
import type { UpdateUserUseCase, UserCommand, UserSummary } from '../ports/in/users.ports.js';
import type { UserChanges } from '../ports/out/user-repository.port.js';
import { assertAnotherAdminRemains, loadUser, toUserSummary } from '../services/user-helpers.js';
import type { UsersDeps } from '../users-deps.js';

type UpdateCommand = UserCommand & { readonly name?: string; readonly role?: UserRole };

function describeChanges(before: User, after: User): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  if (before.name !== after.name) summary['name'] = { from: before.name, to: after.name };
  if (before.role !== after.role) summary['role'] = { from: before.role, to: after.role };
  return summary;
}

function changedFields(before: User, after: User): UserChanges {
  return {
    updatedAt: after.updatedAt,
    ...(before.name === after.name ? {} : { name: after.name }),
    ...(before.role === after.role ? {} : { role: after.role }),
  };
}

export class UpdateUser implements UpdateUserUseCase {
  constructor(private readonly deps: UsersDeps) {}

  async execute(command: UpdateCommand): Promise<UserSummary> {
    assertCanManageUsers(command.actor);
    return this.deps.tx.run(() => this.apply(command));
  }

  private async apply(command: UpdateCommand): Promise<UserSummary> {
    const before = await loadUser(this.deps.users, command.id);
    const after = this.withChanges(before, command);
    const summary = describeChanges(before, after);
    if (Object.keys(summary).length === 0) return toUserSummary(before);

    if (after.role !== 'admin') await assertAnotherAdminRemains(this.deps.users, before);
    await this.deps.users.update(after.id, changedFields(before, after));
    await this.deps.audit.record({
      actorId: command.actor.id,
      actorIp: command.ip,
      action: 'user.update',
      targetType: 'user',
      targetId: after.id,
      summary,
    });
    return toUserSummary(after);
  }

  private withChanges(user: User, command: UpdateCommand): User {
    const now = this.deps.clock.now();
    const renamed = command.name === undefined ? user : user.rename(command.name, now);
    return command.role === undefined ? renamed : renamed.changeRole(command.role, now);
  }
}
