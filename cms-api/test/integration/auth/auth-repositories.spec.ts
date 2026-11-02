import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaAccountRepository } from '../../../src/modules/auth/adapters/out/persistence/prisma-account.repository.js';
import { PrismaApiKeyRepository } from '../../../src/modules/auth/adapters/out/persistence/prisma-api-key.repository.js';
import { PrismaLoginLockoutRepository } from '../../../src/modules/auth/adapters/out/persistence/prisma-login-lockout.repository.js';
import { PrismaPasswordResetTokenRepository } from '../../../src/modules/auth/adapters/out/persistence/prisma-password-reset-token.repository.js';
import { PrismaRefreshTokenRepository } from '../../../src/modules/auth/adapters/out/persistence/prisma-refresh-token.repository.js';
import { ApiKey } from '../../../src/modules/auth/domain/entities/api-key.entity.js';
import { PasswordResetToken } from '../../../src/modules/auth/domain/entities/password-reset-token.entity.js';
import { RefreshToken } from '../../../src/modules/auth/domain/entities/refresh-token.entity.js';
import { LoginLockout } from '../../../src/modules/auth/domain/services/login-lockout.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const USER = '10000000-0000-4000-8000-000000000001';
const OTHER_USER = '10000000-0000-4000-8000-000000000002';
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const T0 = new Date('2026-05-11T10:00:00.000Z');
const later = (ms: number) => new Date(T0.getTime() + ms);

describe('auth persistence adapters', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await db.truncate();
    await db.seedUser(USER, { email: 'alice@example.com', name: 'Alice' });
    await db.seedUser(OTHER_USER);
  });

  describe('PrismaAccountRepository', () => {
    const repo = () => new PrismaAccountRepository(db.context);

    it('maps a row to an account', async () => {
      const account = await repo().findByEmail('alice@example.com');

      expect(account).toMatchObject({
        id: USER,
        email: 'alice@example.com',
        name: 'Alice',
        role: 'editor',
        status: 'active',
        passwordHash: 'stored-hash',
      });
      expect(account?.canLogin()).toBe(true);
    });

    it('finds by id', async () => {
      await expect(repo().findById(USER)).resolves.toMatchObject({ email: 'alice@example.com' });
    });

    it('returns null when nothing matches', async () => {
      await expect(repo().findByEmail('nobody@example.com')).resolves.toBeNull();
      await expect(repo().findById(id(99))).resolves.toBeNull();
    });

    it('keeps a null password hash for an invited user', async () => {
      await db.seedUser(id(50), {
        email: 'new@example.com',
        passwordHash: null,
        status: 'invited',
      });

      const account = await repo().findByEmail('new@example.com');

      expect(account?.passwordHash).toBeNull();
      expect(account?.canLogin()).toBe(false);
    });

    it('updates the password', async () => {
      await repo().updatePassword(USER, 'new-hash');

      await expect(repo().findById(USER)).resolves.toMatchObject({ passwordHash: 'new-hash' });
    });

    it('records the login time', async () => {
      await repo().recordLogin(USER, T0);

      const row = await db.context.client.user.findUniqueOrThrow({ where: { id: USER } });
      expect(row.lastLoginAt).toEqual(T0);
    });
  });

  describe('PrismaLoginLockoutRepository', () => {
    const repo = () => new PrismaLoginLockoutRepository(db.context);

    it('returns an empty lockout for a user with no failures', async () => {
      const lockout = await repo().find(USER);

      expect(lockout.failureCount).toBe(0);
      expect(lockout.isLocked(T0)).toBe(false);
    });

    it('round-trips the state and overwrites on a second save', async () => {
      let lockout = LoginLockout.none().recordFailure(T0);
      await repo().save(USER, lockout);
      for (let i = 0; i < 4; i += 1) lockout = lockout.recordFailure(T0);
      await repo().save(USER, lockout);

      const stored = await repo().find(USER);

      expect(stored.failureCount).toBe(5);
      expect(stored.windowStartedAt).toEqual(T0);
      expect(stored.isLocked(T0)).toBe(true);
    });

    it('clears a lockout, and clearing nothing is harmless', async () => {
      await repo().save(USER, LoginLockout.none().recordFailure(T0));

      await repo().clear(USER);
      await repo().clear(USER);

      await expect(repo().find(USER)).resolves.toMatchObject({ failureCount: 0 });
    });
  });

  describe('PrismaRefreshTokenRepository', () => {
    const repo = () => new PrismaRefreshTokenRepository(db.context);
    const token = (n: number, userId = USER) =>
      RefreshToken.issue({
        id: id(n),
        userId,
        familyId: id(100),
        tokenHash: `hash-${String(n)}`,
        now: T0,
        ttlMs: 60_000,
      });

    it('round-trips a token', async () => {
      await repo().save(token(1));

      const stored = await repo().findByHash('hash-1');

      expect(stored).toEqual(token(1));
      expect(stored?.state(T0)).toBe('active');
    });

    it('returns null for an unknown hash', async () => {
      await expect(repo().findByHash('nope')).resolves.toBeNull();
    });

    it('revokes once and reports false on the second attempt', async () => {
      await repo().save(token(1));

      await expect(repo().revokeIfActive(id(1), later(1))).resolves.toBe(true);
      await expect(repo().revokeIfActive(id(1), later(2))).resolves.toBe(false);

      const stored = await repo().findByHash('hash-1');
      expect(stored?.revokedAt).toEqual(later(1));
    });

    it('lets exactly one concurrent rotation win', async () => {
      await repo().save(token(1));

      const results = await Promise.all(
        Array.from({ length: 8 }, () => repo().revokeIfActive(id(1), later(1))),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('revokes all active tokens of one user and leaves others alone', async () => {
      await repo().save(token(1));
      await repo().save(token(2));
      await repo().save(token(3, OTHER_USER));

      await repo().revokeAllForUser(USER, later(5));

      await expect(repo().findByHash('hash-1')).resolves.toMatchObject({ revokedAt: later(5) });
      await expect(repo().findByHash('hash-2')).resolves.toMatchObject({ revokedAt: later(5) });
      await expect(repo().findByHash('hash-3')).resolves.toMatchObject({ revokedAt: null });
    });

    it('does not move the revocation time of an already revoked token', async () => {
      await repo().save(token(1));
      await repo().revokeIfActive(id(1), later(1));

      await repo().revokeAllForUser(USER, later(9));

      await expect(repo().findByHash('hash-1')).resolves.toMatchObject({ revokedAt: later(1) });
    });
  });

  describe('PrismaPasswordResetTokenRepository', () => {
    const repo = () => new PrismaPasswordResetTokenRepository(db.context);
    const token = (n: number, userId = USER) =>
      PasswordResetToken.issue({ id: id(n), userId, tokenHash: `reset-${String(n)}`, now: T0 });

    it('round-trips a token and persists its consumption', async () => {
      await repo().save(token(1));
      await expect(repo().findByHash('reset-1')).resolves.toEqual(token(1));

      await repo().save(token(1).consume(later(1)));

      const stored = await repo().findByHash('reset-1');
      expect(stored?.usedAt).toEqual(later(1));
    });

    it('returns null for an unknown hash', async () => {
      await expect(repo().findByHash('nope')).resolves.toBeNull();
    });

    it('invalidates only the open tokens of that user', async () => {
      await repo().save(token(1));
      await repo().save(token(2, OTHER_USER));
      await repo().save(token(3).consume(later(1)));

      await repo().invalidateForUser(USER, later(5));

      await expect(repo().findByHash('reset-1')).resolves.toMatchObject({ usedAt: later(5) });
      await expect(repo().findByHash('reset-2')).resolves.toMatchObject({ usedAt: null });
      await expect(repo().findByHash('reset-3')).resolves.toMatchObject({ usedAt: later(1) });
    });
  });

  describe('PrismaApiKeyRepository', () => {
    const repo = () => new PrismaApiKeyRepository(db.context);
    const key = (n: number) =>
      ApiKey.create({
        id: id(n),
        name: `Key ${String(n)}`,
        prefix: 'cmsk_abc',
        keyHash: `key-${String(n)}`,
        createdBy: USER,
        now: later(n),
      });

    it('round-trips a key by id and by hash', async () => {
      await repo().save(key(1));

      await expect(repo().findById(id(1))).resolves.toEqual(key(1));
      await expect(repo().findByHash('key-1')).resolves.toEqual(key(1));
    });

    it('returns null when nothing matches', async () => {
      await expect(repo().findById(id(99))).resolves.toBeNull();
      await expect(repo().findByHash('nope')).resolves.toBeNull();
    });

    it('persists revocation and last use', async () => {
      await repo().save(key(1));

      await repo().save(key(1).markUsed(later(50)).revoke(later(60)));

      await expect(repo().findById(id(1))).resolves.toMatchObject({
        lastUsedAt: later(50),
        revokedAt: later(60),
      });
    });

    it('lists the newest first', async () => {
      await repo().save(key(1));
      await repo().save(key(2));

      const keys = await repo().findAll();

      expect(keys.map((k) => k.id)).toEqual([id(2), id(1)]);
    });
  });

  describe('PrismaContext transactions', () => {
    const tokens = () => new PrismaRefreshTokenRepository(db.context);
    const token = RefreshToken.issue({
      id: id(1),
      userId: USER,
      familyId: id(100),
      tokenHash: 'tx-hash',
      now: T0,
      ttlMs: 60_000,
    });

    it('commits when the work succeeds and returns its result', async () => {
      const result = await db.context.run(async () => {
        await tokens().save(token);
        return 'done';
      });

      expect(result).toBe('done');
      await expect(tokens().findByHash('tx-hash')).resolves.not.toBeNull();
    });

    it('rolls back every repository when the work throws', async () => {
      await expect(
        db.context.run(async () => {
          await tokens().save(token);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      await expect(tokens().findByHash('tx-hash')).resolves.toBeNull();
    });
  });
});
