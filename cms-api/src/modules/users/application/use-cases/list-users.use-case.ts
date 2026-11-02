import type { Actor } from '../../../../shared/kernel/actor.js';
import { type PagedResult, toPageRequest } from '../../../../shared/kernel/paged-result.js';
import { assertCanManageUsers } from '../policies/user.policy.js';
import type { ListUsersUseCase, UserSummary } from '../ports/in/users.ports.js';
import { toUserSummary } from '../services/user-helpers.js';
import type { UsersDeps } from '../users-deps.js';

export class ListUsers implements ListUsersUseCase {
  constructor(private readonly deps: UsersDeps) {}

  async execute(command: {
    readonly actor: Actor;
    readonly page?: number;
    readonly pageSize?: number;
  }): Promise<PagedResult<UserSummary>> {
    assertCanManageUsers(command.actor);
    const result = await this.deps.users.findMany(toPageRequest(command));
    return { ...result, items: result.items.map(toUserSummary) };
  }
}
