import { beforeEach, describe, expect, it } from 'vitest';
import {
  anAccount,
  createAuthContext,
  VALID_PASSWORD,
  type AuthContext,
} from '../../../../../test/builders/auth-context.js';
import { InvalidCredentialsError } from '../../domain/errors/auth.errors.js';
import { Login } from './login.use-case.js';

describe('Login', () => {
  let ctx: AuthContext;
  let login: Login;
  const attempt = (password = VALID_PASSWORD, email = 'alice@example.com') =>
    login.execute({ email, password, ip: '203.0.113.9' });

  beforeEach(() => {
    ctx = createAuthContext();
    login = new Login(ctx);
    ctx.accounts.add(anAccount());
  });

  describe('with correct credentials (FR-AUTH-01)', () => {
    it('returns an access token, refresh token and the user', async () => {
      const result = await attempt();

      expect(result.accessToken).toBe('access-1');
      expect(result.refreshToken).toBe('opaque-1');
      expect(result.expiresInSeconds).toBe(900);
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        role: 'editor',
      });
    });

    it('signs the access token with the id and role and configured lifetime', async () => {
      await attempt();

      expect(ctx.signer.signed).toEqual([
        { claims: { userId: 'user-1', role: 'editor' }, ttlSeconds: 900 },
      ]);
    });

    it('stores only the hash of the refresh token', async () => {
      await attempt();

      const [stored] = [...ctx.refreshTokens.tokens.values()];
      expect(stored?.tokenHash).toBe('sha:opaque-1');
      expect(stored?.userId).toBe('user-1');
      expect(stored?.state(ctx.clock.now())).toBe('active');
    });

    it('starts a new token family for each login', async () => {
      await attempt();
      await attempt();

      const families = new Set([...ctx.refreshTokens.tokens.values()].map((t) => t.familyId));
      expect(families.size).toBe(2);
    });

    it('accepts the email in any case', async () => {
      await expect(attempt(VALID_PASSWORD, ' ALICE@example.com ')).resolves.toBeDefined();
    });

    it('records the login time', async () => {
      await attempt();

      expect(ctx.accounts.lastLogins.get('user-1')).toEqual(ctx.clock.now());
    });

    it('writes a success audit event as FR-AUTH-10 requires', async () => {
      await attempt();

      expect(ctx.audit.events).toEqual([
        {
          actorId: 'user-1',
          actorIp: '203.0.113.9',
          action: 'auth.login.success',
          targetType: 'user',
          targetId: 'user-1',
          summary: {},
        },
      ]);
    });

    it('uses one transaction to admit the attempt and one to persist the session', async () => {
      await attempt();

      expect(ctx.tx.runs).toBe(2);
    });
  });

  describe('with a wrong password', () => {
    it('rejects with the generic error', async () => {
      await expect(attempt('wrong-password-1')).rejects.toThrow(InvalidCredentialsError);
    });

    it('issues no session', async () => {
      await expect(attempt('wrong-password-1')).rejects.toThrow();

      expect(ctx.refreshTokens.tokens.size).toBe(0);
      expect(ctx.signer.signed).toEqual([]);
      expect(ctx.accounts.lastLogins.size).toBe(0);
    });

    it('writes a failure audit event without the password', async () => {
      await expect(attempt('wrong-password-1')).rejects.toThrow();

      expect(ctx.audit.events).toEqual([
        {
          actorId: 'user-1',
          actorIp: '203.0.113.9',
          action: 'auth.login.failure',
          targetType: 'user',
          targetId: 'user-1',
          summary: { reason: 'bad_credentials' },
        },
      ]);
    });
  });

  describe('account lockout (FR-AUTH-06)', () => {
    const failTimes = async (count: number) => {
      for (let i = 0; i < count; i += 1) {
        await expect(attempt('wrong-password-1')).rejects.toThrow(InvalidCredentialsError);
      }
    };

    it('rejects the correct password after 5 failures within 10 minutes', async () => {
      await failTimes(5);

      await expect(attempt()).rejects.toThrow(InvalidCredentialsError);
      expect(ctx.refreshTokens.tokens.size).toBe(0);
    });

    it('still allows the correct password after 4 failures', async () => {
      await failTimes(4);

      await expect(attempt()).resolves.toBeDefined();
    });

    it('allows login again once 15 minutes have passed', async () => {
      await failTimes(5);
      ctx.clock.advanceMinutes(15);

      await expect(attempt()).resolves.toBeDefined();
    });

    it('does not extend the lock when attempts continue during it', async () => {
      await failTimes(5);
      ctx.clock.advanceMinutes(14);
      await expect(attempt('wrong-password-1')).rejects.toThrow();
      ctx.clock.advanceMinutes(1);

      await expect(attempt()).resolves.toBeDefined();
    });

    it('clears earlier failures after a successful login', async () => {
      await failTimes(4);
      await attempt();
      await failTimes(4);

      await expect(attempt()).resolves.toBeDefined();
    });

    it('charges an attempt before verifying, so parallel guesses cannot exceed the limit', async () => {
      let verifications = 0;
      const verify = ctx.hasher.verify.bind(ctx.hasher);
      ctx.hasher.verify = async (hash, password) => {
        verifications += 1;
        await new Promise((resolve) => setImmediate(resolve));
        return verify(hash, password);
      };

      await Promise.allSettled(Array.from({ length: 20 }, () => attempt('wrong-password-1')));

      expect(verifications).toBe(5);
    });

    it('still admits the correct password on the 5th attempt', async () => {
      await failTimes(4);

      await expect(attempt()).resolves.toBeDefined();
    });

    it('audits an attempt made during the lock distinctly', async () => {
      await failTimes(5);

      await expect(attempt()).rejects.toThrow();

      expect(ctx.audit.actions().at(-1)).toBe('auth.login.locked');
      expect(ctx.audit.events.at(-1)?.actorId).toBe('user-1');
    });

    it('does the hashing work during a lock so timing does not reveal it', async () => {
      await failTimes(5);

      await expect(attempt()).rejects.toThrow();

      expect(ctx.hasher.nothingVerifications).toBe(1);
    });
  });

  describe('with an account that cannot log in', () => {
    it.each([
      ['deactivated', { status: 'deactivated' }],
      ['invited', { status: 'invited', passwordHash: null }],
    ] as const)('rejects a %s account with the generic error', async (_name, overrides) => {
      ctx.accounts.add(anAccount(overrides));

      await expect(attempt()).rejects.toThrow(InvalidCredentialsError);
      expect(ctx.refreshTokens.tokens.size).toBe(0);
    });

    it('does the hashing work for an account with no password', async () => {
      ctx.accounts.add(anAccount({ status: 'invited', passwordHash: null }));

      await expect(attempt()).rejects.toThrow();

      expect(ctx.hasher.nothingVerifications).toBe(1);
    });
  });

  describe('with an unknown email', () => {
    it('rejects with the same generic error and audits no actor', async () => {
      await expect(attempt(VALID_PASSWORD, 'nobody@example.com')).rejects.toThrow(
        InvalidCredentialsError,
      );

      expect(ctx.audit.events).toEqual([
        {
          actorId: null,
          actorIp: '203.0.113.9',
          action: 'auth.login.failure',
          targetType: null,
          targetId: null,
          summary: { reason: 'unknown_account' },
        },
      ]);
    });

    it('does the hashing work so timing does not reveal which emails exist', async () => {
      await expect(attempt(VALID_PASSWORD, 'nobody@example.com')).rejects.toThrow();

      expect(ctx.hasher.nothingVerifications).toBe(1);
    });

    it('treats a malformed email as unknown rather than a validation error', async () => {
      await expect(attempt(VALID_PASSWORD, 'not-an-email')).rejects.toThrow(
        InvalidCredentialsError,
      );
    });
  });

  it('never reports a difference between failure causes to the client', async () => {
    const messages = await Promise.all(
      ['wrong-password-1', VALID_PASSWORD].map((password, index) =>
        attempt(password, index === 0 ? 'alice@example.com' : 'nobody@example.com').catch(
          (error: unknown) => (error as Error).message,
        ),
      ),
    );

    expect(messages[0]).toBe(messages[1]);
  });
});
