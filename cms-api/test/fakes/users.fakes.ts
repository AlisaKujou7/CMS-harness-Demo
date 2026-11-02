import type { UserRepository } from '../../src/modules/users/application/ports/out/user-repository.port.js';
import type { User } from '../../src/modules/users/domain/entities/user.entity.js';
import {
  EmailTakenError,
  UserInUseError,
} from '../../src/modules/users/domain/errors/user.errors.js';
import {
  pagedResult,
  type PagedResult,
  type PageRequest,
} from '../../src/shared/kernel/paged-result.js';

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();
  readonly inUse = new Set<string>();

  add(user: User): void {
    this.users.set(user.id, user);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    const found = [...this.users.values()].find((user) => user.email === email);
    return Promise.resolve(found ?? null);
  }

  findMany(page: PageRequest): Promise<PagedResult<User>> {
    const all = [...this.users.values()];
    const start = (page.page - 1) * page.pageSize;
    return Promise.resolve(pagedResult(all.slice(start, start + page.pageSize), all.length, page));
  }

  save(user: User): Promise<void> {
    const clash = [...this.users.values()].some((u) => u.email === user.email && u.id !== user.id);
    if (clash) return Promise.reject(new EmailTakenError());
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    if (this.inUse.has(id)) return Promise.reject(new UserInUseError());
    this.users.delete(id);
    return Promise.resolve();
  }

  lockActiveAdminIds(): Promise<readonly string[]> {
    const admins = [...this.users.values()].filter((user) => user.isActiveAdmin());
    return Promise.resolve(admins.map((user) => user.id));
  }
}
