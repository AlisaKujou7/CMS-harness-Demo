import { beforeEach, describe, expect, it } from 'vitest';
import {
  anAccount,
  createAuthContext,
  VALID_PASSWORD,
  type AuthContext,
} from '../../../../../test/builders/auth-context.js';
import { InvalidRefreshTokenError } from '../../domain/errors/auth.errors.js';
import { Login } from './login.use-case.js';
import { Logout } from './logout.use-case.js';
import { RefreshTokenSession } from './refresh-token.use-case.js';

describe('RefreshTokenSession', () => {
  let ctx: AuthContext;
  let refresh: RefreshTokenSession;
  let firstToken: string;
  const use = (refreshToken: string) => refresh.execute({ refreshToken, ip: '203.0.113.9' });

  beforeEach(async () => {
    ctx = createAuthContext();
    refresh = new RefreshTokenSession(ctx);
    ctx.accounts.add(anAccount());
    const session = await new Login(ctx).execute({
      email: 'alice@example.com',
      password: VALID_PASSWORD,
      ip: null,
    });
    firstToken = session.refreshToken;
    ctx.audit.events.length = 0;
  });

  it('issues a new access token and a different refresh token', async () => {
    const result = await use(firstToken);

    expect(result.accessToken).toBe('access-2');
    expect(result.refreshToken).not.toBe(firstToken);
    expect(result.user.id).toBe('user-1');
    expect(result.expiresInSeconds).toBe(900);
  });

  it('revokes the presented token and keeps the same family', async () => {
    const { refreshToken } = await use(firstToken);

    const old = await ctx.refreshTokens.findByHash(`sha:${firstToken}`);
    const next = await ctx.refreshTokens.findByHash(`sha:${refreshToken}`);
    expect(old?.state(ctx.clock.now())).toBe('rotated');
    expect(next?.state(ctx.clock.now())).toBe('active');
    expect(next?.familyId).toBe(old?.familyId);
  });

  it('takes the role from the current account, not the old session', async () => {
    ctx.accounts.add(anAccount({ role: 'admin' }));

    const result = await use(firstToken);

    expect(result.user.role).toBe('admin');
    expect(ctx.signer.signed.at(-1)?.claims.role).toBe('admin');
  });

  it('runs inside a transaction', async () => {
    const before = ctx.tx.runs;

    await use(firstToken);

    expect(ctx.tx.runs).toBe(before + 1);
  });

  it('rejects a token it has never seen', async () => {
    await expect(use('made-up')).rejects.toThrow(InvalidRefreshTokenError);
    expect(ctx.audit.events).toEqual([]);
  });

  it('rejects an expired token after 30 idle minutes (SEC-12)', async () => {
    ctx.clock.advanceMinutes(30);

    await expect(use(firstToken)).rejects.toThrow(InvalidRefreshTokenError);
    expect(ctx.signer.signed).toHaveLength(1);
  });

  describe('reuse detection', () => {
    const pastGrace = () => {
      ctx.clock.advanceMs(10_000);
    };

    it('rejects a token that was rotated more than 10 seconds ago', async () => {
      await use(firstToken);
      pastGrace();

      await expect(use(firstToken)).rejects.toThrow(InvalidRefreshTokenError);
    });

    it('revokes every session of the user, including the newest token', async () => {
      const { refreshToken } = await use(firstToken);
      pastGrace();

      await expect(use(firstToken)).rejects.toThrow();

      await expect(use(refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
      const newest = await ctx.refreshTokens.findByHash(`sha:${refreshToken}`);
      expect(newest?.state(ctx.clock.now())).toBe('revoked');
    });

    it('writes a security audit event', async () => {
      await use(firstToken);
      pastGrace();

      await expect(use(firstToken)).rejects.toThrow();

      expect(ctx.audit.events.at(-1)).toEqual({
        actorId: 'user-1',
        actorIp: '203.0.113.9',
        action: 'auth.session.reuse_detected',
        targetType: 'user',
        targetId: 'user-1',
        summary: {},
      });
    });
  });

  describe('a token revoked for an ordinary reason', () => {
    const signInAgain = () =>
      new Login(ctx).execute({ email: 'alice@example.com', password: VALID_PASSWORD, ip: null });

    it('is refused without touching other sessions after logout', async () => {
      const other = await signInAgain();
      await new Logout(ctx).execute({ refreshToken: firstToken, ip: null });
      ctx.audit.events.length = 0;

      await expect(use(firstToken)).rejects.toThrow(InvalidRefreshTokenError);

      await expect(use(other.refreshToken)).resolves.toBeDefined();
      expect(ctx.audit.events).toEqual([]);
    });

    it('does not kill a session started after a password change on another device', async () => {
      const deviceB = firstToken;
      await ctx.refreshTokens.revokeAllForUser('user-1', ctx.clock.now());
      const deviceA = await signInAgain();
      ctx.audit.events.length = 0;

      await expect(use(deviceB)).rejects.toThrow(InvalidRefreshTokenError);

      await expect(use(deviceA.refreshToken)).resolves.toBeDefined();
      expect(ctx.audit.actions()).not.toContain('auth.session.reuse_detected');
    });
  });

  describe('concurrent refreshes from two tabs sharing a cookie', () => {
    it('gives the second tab a working session inside the grace period', async () => {
      const first = await use(firstToken);
      ctx.clock.advanceMs(9_999);

      const second = await use(firstToken);

      expect(second.refreshToken).not.toBe(first.refreshToken);
      await expect(use(first.refreshToken)).resolves.toBeDefined();
      await expect(use(second.refreshToken)).resolves.toBeDefined();
      expect(ctx.audit.actions()).not.toContain('auth.session.reuse_detected');
    });

    it('treats losing the race to rotate as being inside the grace period', async () => {
      const original = ctx.refreshTokens.markRotatedIfActive.bind(ctx.refreshTokens);
      ctx.refreshTokens.markRotatedIfActive = async (id, at) => {
        await original(id, at);
        return false;
      };

      await expect(use(firstToken)).resolves.toBeDefined();

      expect(ctx.audit.events).toEqual([]);
    });

    it('refuses when the user was deleted during the race, which removes the token', async () => {
      ctx.refreshTokens.markRotatedIfActive = (id) => {
        ctx.refreshTokens.tokens.delete(id);
        return Promise.resolve(false);
      };

      await expect(use(firstToken)).rejects.toThrow(InvalidRefreshTokenError);
    });

    it('refuses when the race was lost to a logout rather than a rotation', async () => {
      ctx.refreshTokens.markRotatedIfActive = async (id, at) => {
        await ctx.refreshTokens.revokeIfActive(id, at);
        return false;
      };

      await expect(use(firstToken)).rejects.toThrow(InvalidRefreshTokenError);
      expect(ctx.audit.events).toEqual([]);
    });
  });

  describe('when the account can no longer log in', () => {
    it('rejects the token and revokes all sessions', async () => {
      ctx.accounts.add(anAccount({ status: 'deactivated' }));

      await expect(use(firstToken)).rejects.toThrow(InvalidRefreshTokenError);

      const stored = await ctx.refreshTokens.findByHash(`sha:${firstToken}`);
      expect(stored?.state(ctx.clock.now())).toBe('revoked');
    });

    it('rejects the token when the account no longer exists', async () => {
      ctx.accounts.accounts.clear();

      await expect(use(firstToken)).rejects.toThrow(InvalidRefreshTokenError);
    });
  });
});

describe('Logout', () => {
  let ctx: AuthContext;
  let logout: Logout;
  let token: string;

  beforeEach(async () => {
    ctx = createAuthContext();
    logout = new Logout(ctx);
    ctx.accounts.add(anAccount());
    const session = await new Login(ctx).execute({
      email: 'alice@example.com',
      password: VALID_PASSWORD,
      ip: null,
    });
    token = session.refreshToken;
    ctx.audit.events.length = 0;
  });

  it('revokes the current refresh token server side (FR-AUTH-09)', async () => {
    await logout.execute({ refreshToken: token, ip: '203.0.113.9' });

    const stored = await ctx.refreshTokens.findByHash(`sha:${token}`);
    expect(stored?.state(ctx.clock.now())).toBe('revoked');
  });

  it('writes a logout audit event', async () => {
    await logout.execute({ refreshToken: token, ip: '203.0.113.9' });

    expect(ctx.audit.events).toEqual([
      {
        actorId: 'user-1',
        actorIp: '203.0.113.9',
        action: 'auth.logout',
        targetType: 'user',
        targetId: 'user-1',
        summary: {},
      },
    ]);
  });

  it('succeeds quietly for an unknown token', async () => {
    await expect(logout.execute({ refreshToken: 'unknown', ip: null })).resolves.toBeUndefined();

    expect(ctx.audit.events).toEqual([]);
  });

  it('does not audit a second logout with the same token', async () => {
    await logout.execute({ refreshToken: token, ip: null });
    await logout.execute({ refreshToken: token, ip: null });

    expect(ctx.audit.events).toHaveLength(1);
  });
});
