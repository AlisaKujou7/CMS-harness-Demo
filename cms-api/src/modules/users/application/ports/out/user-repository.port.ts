import type { PagedResult, PageRequest } from '../../../../../shared/kernel/paged-result.js';
import type { User, UserProps } from '../../../domain/entities/user.entity.js';

// Only what changed, so a write from a stale read cannot undo another admin's change.
export type UserChanges = Partial<Pick<UserProps, 'name' | 'role' | 'status'>> &
  Pick<UserProps, 'updatedAt'>;

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findMany(page: PageRequest): Promise<PagedResult<User>>;
  // Throws EmailTakenError when another user holds the email.
  create(user: User): Promise<void>;
  update(id: string, changes: UserChanges): Promise<void>;
  // Throws UserInUseError while other records still reference the user.
  delete(id: string): Promise<void>;
  // Locks the rows for the current transaction, so two admins cannot remove each other at once.
  lockActiveAdminIds(): Promise<readonly string[]>;
}
