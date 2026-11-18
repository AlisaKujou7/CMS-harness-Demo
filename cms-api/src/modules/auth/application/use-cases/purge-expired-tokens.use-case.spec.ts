import { describe, expect, it } from 'vitest';
import { createAuthContext } from '../../../../../test/builders/auth-context.js';
import { InvitationToken } from '../../domain/entities/invitation-token.entity.js';
import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity.js';
import { RefreshToken } from '../../domain/entities/refresh-token.entity.js';
import { PurgeExpiredTokens } from './purge-expired-tokens.use-case.js';

describe('PurgeExpiredTokens', () => {
  it('removes expired tokens of every kind, keeps live ones, and counts what went', async () => {
    const ctx = createAuthContext();
    const now = ctx.clock.now().getTime();
    const past = new Date(now - 1000);
    const future = new Date(now + 1000);
    const common = { userId: 'u', usedAt: null };
    const refresh = (id: string, expiresAt: Date) =>
      RefreshToken.restore({
        id,
        userId: 'u',
        familyId: 'f',
        tokenHash: id,
        issuedAt: past,
        expiresAt,
        revokedAt: null,
        rotatedAt: null,
      });

    await ctx.refreshTokens.save(refresh('r-old', past));
    await ctx.refreshTokens.save(refresh('r-new', future));
    await ctx.resetTokens.save(
      PasswordResetToken.restore({ ...common, id: 'p', tokenHash: 'p', expiresAt: past }),
    );
    await ctx.invitationTokens.save(
      InvitationToken.restore({ ...common, id: 'i', tokenHash: 'i', expiresAt: past }),
    );

    await expect(new PurgeExpiredTokens(ctx).execute()).resolves.toBe(3);

    expect([...ctx.refreshTokens.tokens.keys()]).toEqual(['r-new']);
    expect(ctx.resetTokens.tokens.size).toBe(0);
    expect(ctx.invitationTokens.tokens.size).toBe(0);
  });
});
