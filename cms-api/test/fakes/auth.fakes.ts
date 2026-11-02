import type {
  AccountRepository,
  ApiKeyRepository,
  LoginLockoutRepository,
  PasswordResetTokenRepository,
  RefreshTokenRepository,
} from '../../src/modules/auth/application/ports/out/repositories.port.js';
import type {
  AccessTokenClaims,
  AccessTokenSigner,
  OpaqueTokenService,
  PasswordHasher,
} from '../../src/modules/auth/application/ports/out/security.port.js';
import { Account } from '../../src/modules/auth/domain/entities/account.entity.js';
import type { ApiKey } from '../../src/modules/auth/domain/entities/api-key.entity.js';
import { PasswordResetToken } from '../../src/modules/auth/domain/entities/password-reset-token.entity.js';
import type { RefreshToken } from '../../src/modules/auth/domain/entities/refresh-token.entity.js';
import { LoginLockout } from '../../src/modules/auth/domain/services/login-lockout.js';

export class InMemoryAccountRepository implements AccountRepository {
  readonly accounts = new Map<string, Account>();
  readonly lastLogins = new Map<string, Date>();

  add(account: Account): void {
    this.accounts.set(account.id, account);
  }

  findByEmail(email: string): Promise<Account | null> {
    const found = [...this.accounts.values()].find((account) => account.email === email);
    return Promise.resolve(found ?? null);
  }

  findById(id: string): Promise<Account | null> {
    return Promise.resolve(this.accounts.get(id) ?? null);
  }

  updatePassword(id: string, passwordHash: string): Promise<void> {
    const account = this.accounts.get(id);
    if (account) this.accounts.set(id, new Account({ ...account, passwordHash }));
    return Promise.resolve();
  }

  recordLogin(id: string, at: Date): Promise<void> {
    this.lastLogins.set(id, at);
    return Promise.resolve();
  }
}

export class InMemoryLoginLockoutRepository implements LoginLockoutRepository {
  private readonly lockouts = new Map<string, LoginLockout>();

  find(userId: string): Promise<LoginLockout> {
    return Promise.resolve(this.lockouts.get(userId) ?? LoginLockout.none());
  }

  save(userId: string, lockout: LoginLockout): Promise<void> {
    this.lockouts.set(userId, lockout);
    return Promise.resolve();
  }

  clear(userId: string): Promise<void> {
    this.lockouts.delete(userId);
    return Promise.resolve();
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly tokens = new Map<string, RefreshToken>();

  save(token: RefreshToken): Promise<void> {
    this.tokens.set(token.id, token);
    return Promise.resolve();
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const found = [...this.tokens.values()].find((token) => token.tokenHash === tokenHash);
    return Promise.resolve(found ?? null);
  }

  revokeIfActive(id: string, at: Date): Promise<boolean> {
    const token = this.tokens.get(id);
    if (!token || token.revokedAt !== null) return Promise.resolve(false);
    this.tokens.set(id, token.revoke(at));
    return Promise.resolve(true);
  }

  revokeAllForUser(userId: string, at: Date): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.userId === userId && token.revokedAt === null) {
        this.tokens.set(token.id, token.revoke(at));
      }
    }
    return Promise.resolve();
  }
}

export class InMemoryPasswordResetTokenRepository implements PasswordResetTokenRepository {
  readonly tokens = new Map<string, PasswordResetToken>();

  save(token: PasswordResetToken): Promise<void> {
    this.tokens.set(token.id, token);
    return Promise.resolve();
  }

  findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const found = [...this.tokens.values()].find((token) => token.tokenHash === tokenHash);
    return Promise.resolve(found ?? null);
  }

  invalidateForUser(userId: string, at: Date): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.userId === userId && token.usedAt === null) {
        this.tokens.set(token.id, PasswordResetToken.restore({ ...token, usedAt: at }));
      }
    }
    return Promise.resolve();
  }
}

export class InMemoryApiKeyRepository implements ApiKeyRepository {
  readonly keys = new Map<string, ApiKey>();

  save(key: ApiKey): Promise<void> {
    this.keys.set(key.id, key);
    return Promise.resolve();
  }

  findById(id: string): Promise<ApiKey | null> {
    return Promise.resolve(this.keys.get(id) ?? null);
  }

  findByHash(keyHash: string): Promise<ApiKey | null> {
    const found = [...this.keys.values()].find((key) => key.keyHash === keyHash);
    return Promise.resolve(found ?? null);
  }

  findAll(): Promise<readonly ApiKey[]> {
    return Promise.resolve([...this.keys.values()]);
  }
}

export class FakePasswordHasher implements PasswordHasher {
  nothingVerifications = 0;

  hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hashed:${password}`);
  }

  verifyAgainstNothing(): Promise<void> {
    this.nothingVerifications += 1;
    return Promise.resolve();
  }
}

export class FakeAccessTokenSigner implements AccessTokenSigner {
  readonly signed: { claims: AccessTokenClaims; ttlSeconds: number }[] = [];
  private readonly issued = new Map<string, AccessTokenClaims>();

  sign(claims: AccessTokenClaims, ttlSeconds: number): Promise<string> {
    this.signed.push({ claims, ttlSeconds });
    const token = `access-${String(this.signed.length)}`;
    this.issued.set(token, claims);
    return Promise.resolve(token);
  }

  verify(token: string): Promise<AccessTokenClaims | null> {
    return Promise.resolve(this.issued.get(token) ?? null);
  }
}

export class FakeOpaqueTokenService implements OpaqueTokenService {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `opaque-${String(this.counter)}`;
  }

  hash(token: string): string {
    return `sha:${token}`;
  }
}
