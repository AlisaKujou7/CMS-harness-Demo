import type { Account } from '../../../domain/entities/account.entity.js';
import type { ApiKey } from '../../../domain/entities/api-key.entity.js';
import type { InvitationToken } from '../../../domain/entities/invitation-token.entity.js';
import type { PasswordResetToken } from '../../../domain/entities/password-reset-token.entity.js';
import type { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import type { LoginLockout } from '../../../domain/services/login-lockout.js';

export interface AccountRepository {
  findByEmail(email: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  activate(id: string, passwordHash: string): Promise<void>;
  recordLogin(id: string, at: Date): Promise<void>;
}

export interface LoginLockoutRepository {
  find(userId: string): Promise<LoginLockout>;
  save(userId: string, lockout: LoginLockout): Promise<void>;
  clear(userId: string): Promise<void>;
}

export interface RefreshTokenRepository {
  save(token: RefreshToken): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  // Returns false when the token was already revoked, which is how a concurrent reuse shows up.
  revokeIfActive(id: string, at: Date): Promise<boolean>;
  revokeAllForUser(userId: string, at: Date): Promise<void>;
}

export interface PasswordResetTokenRepository {
  save(token: PasswordResetToken): Promise<void>;
  findByHash(tokenHash: string): Promise<PasswordResetToken | null>;
  invalidateForUser(userId: string, at: Date): Promise<void>;
}

export interface InvitationTokenRepository {
  save(token: InvitationToken): Promise<void>;
  findByHash(tokenHash: string): Promise<InvitationToken | null>;
  // Returns false when already used, so a link cannot be accepted twice even concurrently.
  consumeIfUnused(id: string, at: Date): Promise<boolean>;
  invalidateForUser(userId: string, at: Date): Promise<void>;
}

export interface ApiKeyRepository {
  save(key: ApiKey): Promise<void>;
  findById(id: string): Promise<ApiKey | null>;
  findByHash(keyHash: string): Promise<ApiKey | null>;
  findAll(): Promise<readonly ApiKey[]>;
}
