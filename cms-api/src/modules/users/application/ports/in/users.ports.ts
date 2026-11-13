import type { Actor, UserRole } from '../../../../../shared/kernel/actor.js';
import type { PagedResult } from '../../../../../shared/kernel/paged-result.js';
import type { UserStatus } from '../../../domain/entities/user.entity.js';

export interface UserSummary {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
}

export interface UserCommand {
  readonly actor: Actor;
  readonly id: string;
  readonly ip: string | null;
}

export interface ListUsersUseCase {
  execute(command: {
    readonly actor: Actor;
    readonly page?: number;
    readonly pageSize?: number;
  }): Promise<PagedResult<UserSummary>>;
}

export interface InviteUserUseCase {
  execute(command: {
    readonly actor: Actor;
    readonly email: string;
    readonly name?: string;
    readonly role: UserRole;
    readonly ip: string | null;
  }): Promise<UserSummary>;
}

export interface UpdateUserUseCase {
  execute(
    command: UserCommand & { readonly name?: string; readonly role?: UserRole },
  ): Promise<UserSummary>;
}

export interface UserActionUseCase {
  execute(command: UserCommand): Promise<void>;
}
