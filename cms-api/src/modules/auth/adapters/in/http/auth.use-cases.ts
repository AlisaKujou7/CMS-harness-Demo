import type {
  ChangePasswordUseCase,
  CompletePasswordResetUseCase,
  CreateApiKeyUseCase,
  ListApiKeysUseCase,
  LoginUseCase,
  LogoutUseCase,
  RefreshTokenUseCase,
  RequestPasswordResetUseCase,
  RevokeApiKeyUseCase,
} from '../../../application/ports/in/auth.ports.js';

export const AUTH_USE_CASES = Symbol('AuthUseCases');

export interface AuthUseCases {
  readonly login: LoginUseCase;
  readonly refresh: RefreshTokenUseCase;
  readonly logout: LogoutUseCase;
  readonly requestPasswordReset: RequestPasswordResetUseCase;
  readonly completePasswordReset: CompletePasswordResetUseCase;
  readonly changePassword: ChangePasswordUseCase;
  readonly createApiKey: CreateApiKeyUseCase;
  readonly listApiKeys: ListApiKeysUseCase;
  readonly revokeApiKey: RevokeApiKeyUseCase;
}
