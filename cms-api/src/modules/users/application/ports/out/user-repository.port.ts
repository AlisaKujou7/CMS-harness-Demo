import type { PagedResult, PageRequest } from '../../../../../shared/kernel/paged-result.js';
import type { User } from '../../../domain/entities/user.entity.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findMany(page: PageRequest): Promise<PagedResult<User>>;
  // Throws EmailTakenError when another user holds the email.
  save(user: User): Promise<void>;
  // Throws UserInUseError while other records still reference the user.
  delete(id: string): Promise<void>;
  // Locks the rows for the current transaction, so two admins cannot remove each other at once.
  lockActiveAdminIds(): Promise<readonly string[]>;
}
