import type { Actor, UserRole } from '../../../../../shared/kernel/actor.js';

export interface SessionResult {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly refreshToken: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly role: UserRole;
  };
}

export interface LoginCommand {
  readonly email: string;
  readonly password: string;
  readonly ip: string | null;
}

export interface LoginUseCase {
  execute(command: LoginCommand): Promise<SessionResult>;
}

export interface SessionTokenCommand {
  readonly refreshToken: string;
  readonly ip: string | null;
}

export interface RefreshTokenUseCase {
  execute(command: SessionTokenCommand): Promise<SessionResult>;
}

export interface LogoutUseCase {
  execute(command: SessionTokenCommand): Promise<void>;
}

export interface RequestPasswordResetUseCase {
  execute(command: { readonly email: string; readonly ip: string | null }): Promise<void>;
}

export interface CompletePasswordResetUseCase {
  execute(command: {
    readonly token: string;
    readonly newPassword: string;
    readonly ip: string | null;
  }): Promise<void>;
}

export interface ChangePasswordUseCase {
  execute(command: {
    readonly actor: Actor;
    readonly currentPassword: string;
    readonly newPassword: string;
    readonly ip: string | null;
  }): Promise<void>;
}

export interface SendInvitationUseCase {
  execute(command: { readonly userId: string; readonly email: string }): Promise<void>;
}

export interface AcceptInvitationUseCase {
  execute(command: {
    readonly token: string;
    readonly newPassword: string;
    readonly ip: string | null;
  }): Promise<void>;
}

export interface RevokeUserSessionsUseCase {
  execute(userId: string): Promise<void>;
}

export interface GetCurrentUserUseCase {
  execute(actor: Actor): Promise<SessionResult['user']>;
}

export interface ApiKeySummary {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
}

export interface CreateApiKeyUseCase {
  execute(command: {
    readonly actor: Actor;
    readonly name: string;
    readonly ip: string | null;
  }): Promise<ApiKeySummary & { readonly key: string }>;
}

export interface ListApiKeysUseCase {
  execute(actor: Actor): Promise<readonly ApiKeySummary[]>;
}

export interface RevokeApiKeyUseCase {
  execute(command: {
    readonly actor: Actor;
    readonly id: string;
    readonly ip: string | null;
  }): Promise<void>;
}

export interface AuthenticateApiKeyUseCase {
  execute(key: string): Promise<{ readonly apiKeyId: string }>;
}
