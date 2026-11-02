import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaInvitationTokenRepository } from '../../../src/modules/auth/adapters/out/persistence/prisma-invitation-token.repository.js';
import { PrismaPasswordResetTokenRepository } from '../../../src/modules/auth/adapters/out/persistence/prisma-password-reset-token.repository.js';
import { PrismaRefreshTokenRepository } from '../../../src/modules/auth/adapters/out/persistence/prisma-refresh-token.repository.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const USER = '10000000-0000-4000-8000-000000000001';
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date('2026-06-01T00:00:00Z');
const PAST = new Date('2026-05-31T00:00:00Z');
const FUTURE = new Date('2026-06-02T00:00:00Z');

describe('deleting expired tokens', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
    await db.seedUser(USER);
  });

  afterAll(() => db.close());

  const expiring = [PAST, FUTURE].map((expiresAt, index) => ({
    id: id(index + 1),
    userId: USER,
    tokenHash: `hash-${String(index)}`,
    expiresAt,
  }));

  it('removes only expired refresh tokens', async () => {
    await db.context.client.refreshToken.createMany({
      data: expiring.map((token) => ({ ...token, familyId: id(9), issuedAt: PAST })),
    });

    const repo = new PrismaRefreshTokenRepository(db.context);
    await expect(repo.deleteExpiredBefore(NOW)).resolves.toBe(1);
    await expect(db.context.client.refreshToken.count()).resolves.toBe(1);
  });

  it('removes only expired password reset tokens', async () => {
    await db.context.client.passwordResetToken.createMany({ data: expiring });

    const repo = new PrismaPasswordResetTokenRepository(db.context);
    await expect(repo.deleteExpiredBefore(NOW)).resolves.toBe(1);
    await expect(db.context.client.passwordResetToken.count()).resolves.toBe(1);
  });

  it('removes only expired invitation tokens', async () => {
    await db.context.client.invitationToken.createMany({ data: expiring });

    const repo = new PrismaInvitationTokenRepository(db.context);
    await expect(repo.deleteExpiredBefore(NOW)).resolves.toBe(1);
    await expect(db.context.client.invitationToken.count()).resolves.toBe(1);
  });
});
