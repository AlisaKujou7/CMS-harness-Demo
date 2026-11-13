import { ApiKey, type ApiKeyProps } from '../../src/modules/auth/domain/entities/api-key.entity.js';
import type { AuthDeps } from '../../src/modules/auth/application/auth-deps.js';
import {
  Account,
  type AccountProps,
} from '../../src/modules/auth/domain/entities/account.entity.js';
import {
  FakeAccessTokenSigner,
  FakeOpaqueTokenService,
  FakePasswordHasher,
  InMemoryAccountRepository,
  InMemoryApiKeyRepository,
  InMemoryInvitationTokenRepository,
  InMemoryLoginLockoutRepository,
  InMemoryPasswordResetTokenRepository,
  InMemoryRefreshTokenRepository,
} from '../fakes/auth.fakes.js';
import {
  FakeClock,
  FakeTransactionRunner,
  InMemoryAuditLog,
  InMemoryEmailSender,
  InMemoryLogger,
  SequentialIdGenerator,
} from '../fakes/system.fakes.js';

export const VALID_PASSWORD = 'correct-horse-1';
export const NEW_PASSWORD = 'battery-staple-2';

export function anAccount(overrides: Partial<AccountProps> = {}): Account {
  return new Account({
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    role: 'editor',
    passwordHash: `hashed:${VALID_PASSWORD}`,
    status: 'active',
    ...overrides,
  });
}

export function anApiKey(overrides: Partial<ApiKeyProps> = {}): ApiKey {
  return ApiKey.restore({
    id: 'key-1',
    name: 'Test',
    prefix: 'cmsk',
    keyHash: 'hash',
    createdBy: 'user-1',
    createdAt: new Date('2026-05-01T00:00:00Z'),
    lastUsedAt: null,
    revokedAt: null,
    ...overrides,
  });
}

export function createAuthContext() {
  const context = {
    accounts: new InMemoryAccountRepository(),
    lockouts: new InMemoryLoginLockoutRepository(),
    refreshTokens: new InMemoryRefreshTokenRepository(),
    resetTokens: new InMemoryPasswordResetTokenRepository(),
    invitationTokens: new InMemoryInvitationTokenRepository(),
    apiKeys: new InMemoryApiKeyRepository(),
    hasher: new FakePasswordHasher(),
    signer: new FakeAccessTokenSigner(),
    opaqueTokens: new FakeOpaqueTokenService(),
    clock: new FakeClock(),
    ids: new SequentialIdGenerator(),
    tx: new FakeTransactionRunner(),
    audit: new InMemoryAuditLog(),
    email: new InMemoryEmailSender(),
    logger: new InMemoryLogger(),
    config: {
      accessTokenTtlSeconds: 900,
      refreshTokenTtlMs: 14 * 24 * 60 * 60_000,
      publicUrl: 'https://cms.example.com',
    },
  } satisfies AuthDeps;
  return context;
}

export type AuthContext = ReturnType<typeof createAuthContext>;
