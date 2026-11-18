import type {
  InviteUserUseCase,
  ListUsersUseCase,
  UpdateUserUseCase,
  UserActionUseCase,
} from '../../../application/ports/in/users.ports.js';

export const USERS_USE_CASES = Symbol('UsersUseCases');

export interface UsersUseCases {
  readonly list: ListUsersUseCase;
  readonly invite: InviteUserUseCase;
  readonly update: UpdateUserUseCase;
  readonly deactivate: UserActionUseCase;
  readonly remove: UserActionUseCase;
  readonly requestPasswordReset: UserActionUseCase;
  readonly resendInvitation: UserActionUseCase;
}
