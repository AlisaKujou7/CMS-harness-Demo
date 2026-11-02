import { beforeEach, describe, expect, it } from 'vitest';
import {
  anAccount,
  createAuthContext,
  NEW_PASSWORD,
  VALID_PASSWORD,
  type AuthContext,
} from '../../../../../test/builders/auth-context.js';
import { InvitationToken } from '../../domain/entities/invitation-token.entity.js';
import {
  InvalidAccessTokenError,
  InvalidInvitationError,
} from '../../domain/errors/auth.errors.js';
import { WeakPasswordError } from '../../domain/value-objects/password.vo.js';
import { AcceptInvitation } from './accept-invitation.use-case.js';
import { GetCurrentUser } from './get-current-user.use-case.js';
import { Login } from './login.use-case.js';
import { RevokeUserSessions } from './revoke-user-sessions.use-case.js';
import { SendInvitation } from './send-invitation.use-case.js';

const T0 = new Date('2026-05-11T10:00:00Z');
const DAY = 86_400_000;

describe('InvitationToken', () => {
  const token = () => InvitationToken.issue({ id: 'i1', userId: 'u1', tokenHash: 'h', now: T0 });

  it('stays usable for just under 7 days (FR-USER-02)', () => {
    expect(token().isUsable(new Date(T0.getTime() + 7 * DAY - 1))).toBe(true);
    expect(token().isUsable(new Date(T0.getTime() + 7 * DAY))).toBe(false);
  });

  it('is unusable once used', () => {
    const used = InvitationToken.restore({ ...token(), usedAt: T0 });

    expect(used.isUsable(T0)).toBe(false);
  });

  it('exposes its fields', () => {
    expect(token()).toMatchObject({ id: 'i1', userId: 'u1', tokenHash: 'h', usedAt: null });
  });
});

describe('invitation use cases', () => {
  let ctx: AuthContext;
  const INVITED = 'alice@example.com';

  beforeEach(() => {
    ctx = createAuthContext();
    ctx.accounts.add(anAccount({ status: 'invited', passwordHash: null }));
  });

  const send = () => new SendInvitation(ctx).execute({ userId: 'user-1', email: INVITED });
  const accept = (token = 'opaque-1', newPassword = NEW_PASSWORD) =>
    new AcceptInvitation(ctx).execute({ token, newPassword, ip: '203.0.113.9' });

  describe('SendInvitation', () => {
    it('emails a one-time link and stores only the hash', async () => {
      await send();

      expect(ctx.email.sent[0]?.to).toBe(INVITED);
      expect(ctx.email.sent[0]?.subject).toBe('You have been invited to the CMS');
      expect(ctx.email.sent[0]?.text).toContain(
        'https://cms.example.com/accept-invitation?token=opaque-1',
      );
      expect(ctx.email.sent[0]?.text).toContain('7 days');
      const [stored] = [...ctx.invitationTokens.tokens.values()];
      expect(stored?.tokenHash).toBe('sha:opaque-1');
      expect(stored?.userId).toBe('user-1');
    });

    it('invalidates earlier links when resent', async () => {
      await send();
      await send();

      const first = await ctx.invitationTokens.findByHash('sha:opaque-1');
      const second = await ctx.invitationTokens.findByHash('sha:opaque-2');
      expect(first?.isUsable(ctx.clock.now())).toBe(false);
      expect(second?.isUsable(ctx.clock.now())).toBe(true);
    });

    it('logs a delivery failure by user id only and resolves', async () => {
      ctx.email.failWith = new Error('smtp down');

      await expect(send()).resolves.toBeUndefined();

      expect(ctx.logger.errors).toEqual([
        { message: 'Invitation email failed', context: { userId: 'user-1' } },
      ]);
    });
  });

  describe('AcceptInvitation', () => {
    beforeEach(async () => {
      await send();
    });

    it('sets the password and activates the account so it can log in', async () => {
      await accept();

      expect(ctx.accounts.accounts.get('user-1')?.status).toBe('active');
      await expect(
        new Login(ctx).execute({ email: INVITED, password: NEW_PASSWORD, ip: null }),
      ).resolves.toBeDefined();
    });

    it('audits the acceptance', async () => {
      await accept();

      expect(ctx.audit.events.at(-1)).toEqual({
        actorId: 'user-1',
        actorIp: '203.0.113.9',
        action: 'user.invitation_accepted',
        targetType: 'user',
        targetId: 'user-1',
        summary: {},
      });
    });

    it('commits inside a transaction', async () => {
      const before = ctx.tx.runs;

      await accept();

      expect(ctx.tx.runs).toBe(before + 1);
    });

    it('refuses a link used twice', async () => {
      await accept();

      await expect(accept('opaque-1', 'another-pass-3')).rejects.toThrow(InvalidInvitationError);
    });

    it('refuses when it loses a concurrent acceptance', async () => {
      ctx.invitationTokens.consumeIfUnused = () => Promise.resolve(false);

      await expect(accept()).rejects.toThrow(InvalidInvitationError);

      expect(ctx.accounts.accounts.get('user-1')?.status).toBe('invited');
    });

    it('refuses a link after 7 days', async () => {
      ctx.clock.advanceMs(7 * DAY);

      await expect(accept()).rejects.toThrow(InvalidInvitationError);
    });

    it('refuses an unknown token', async () => {
      await expect(accept('nope')).rejects.toThrow(InvalidInvitationError);
    });

    it('refuses a weak password and keeps the link usable', async () => {
      await expect(accept('opaque-1', 'short1')).rejects.toThrow(WeakPasswordError);

      await expect(accept()).resolves.toBeUndefined();
    });

    it('will not reactivate a user deactivated after being invited', async () => {
      ctx.accounts.add(anAccount({ status: 'deactivated', passwordHash: null }));

      await expect(accept()).rejects.toThrow(InvalidInvitationError);
    });

    it('refuses when the account no longer exists', async () => {
      ctx.accounts.accounts.clear();

      await expect(accept()).rejects.toThrow(InvalidInvitationError);
    });

    it('describes a bad link as a validation error on the token', () => {
      const error = new InvalidInvitationError();

      expect(error.kind).toBe('validation');
      expect(error.details).toEqual({ field: 'token' });
    });
  });
});

describe('RevokeUserSessions (FR-AUTH-05)', () => {
  it('revokes every refresh token of the user', async () => {
    const ctx = createAuthContext();
    ctx.accounts.add(anAccount());
    const session = await new Login(ctx).execute({
      email: 'alice@example.com',
      password: VALID_PASSWORD,
      ip: null,
    });

    await new RevokeUserSessions(ctx).execute('user-1');

    const stored = await ctx.refreshTokens.findByHash(`sha:${session.refreshToken}`);
    expect(stored?.state(ctx.clock.now())).toBe('revoked');
  });
});

describe('GetCurrentUser', () => {
  it('returns the profile of the signed-in user', async () => {
    const ctx = createAuthContext();
    ctx.accounts.add(anAccount());

    await expect(
      new GetCurrentUser(ctx).execute({ id: 'user-1', role: 'editor' }),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'editor',
    });
  });

  it('rejects when the account has gone', async () => {
    const ctx = createAuthContext();

    await expect(new GetCurrentUser(ctx).execute({ id: 'gone', role: 'editor' })).rejects.toThrow(
      InvalidAccessTokenError,
    );
  });
});
