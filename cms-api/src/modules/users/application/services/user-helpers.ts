import type { User } from '../../domain/entities/user.entity.js';
import { LastAdminError, UserNotFoundError } from '../../domain/errors/user.errors.js';
import type { UserSummary } from '../ports/in/users.ports.js';
import type { UserRepository } from '../ports/out/user-repository.port.js';

export function toUserSummary(user: User): UserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function loadUser(users: UserRepository, id: string): Promise<User> {
  const user = await users.findById(id);
  if (!user) throw new UserNotFoundError();
  return user;
}

// Call inside the transaction that removes the admin: the repository holds row locks until commit.
export async function assertAnotherAdminRemains(users: UserRepository, user: User): Promise<void> {
  if (!user.isActiveAdmin()) return;
  const admins = await users.lockActiveAdminIds();
  if (admins.length <= 1) throw new LastAdminError();
}
