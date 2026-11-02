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
    expect(old?.state(ctx.clock.now())).toBe('revoked');
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
    it('rejects a token that was already rotated', async () => {
      await use(firstToken);

      await expect(use(firstToken)).rejects.toThrow(InvalidRefreshTokenError);
    });

    it('revokes every session of the user, including the newest token', async () => {
      const { refreshToken } = await use(firstToken);

      await expect(use(firstToken)).rejects.toThrow();

      await expect(use(refreshToken)).rejects.toThrow(InvalidRefreshTokenError);
      const states = [...ctx.refreshTokens.tokens.values()].map((t) => t.state(ctx.clock.now()));
      expect(new Set(states)).toEqual(new Set(['revoked']));
    });

    it('writes a security audit event', async () => {
      await use(firstToken);

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

    it('treats losing a concurrent rotation as reuse', async () => {
      const original = ctx.refreshTokens.revokeIfActive.bind(ctx.refreshTokens);
      ctx.refreshTokens.revokeIfActive = async (id, at) => {
        await original(id, at);
        return false;
      };

      await expect(use(firstToken)).rejects.toThrow(InvalidRefreshTokenError);

      expect(ctx.audit.actions()).toEqual(['auth.session.reuse_detected']);
      expect(ctx.signer.signed).toHaveLength(1);
    });

    it('does not treat a token revoked by logout differently from reuse', async () => {
      await new Logout(ctx).execute({ refreshToken: firstToken, ip: null });

      await expect(use(firstToken)).rejects.toThrow(InvalidRefreshTokenError);
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
