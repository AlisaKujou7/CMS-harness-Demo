import { beforeEach, describe, expect, it } from 'vitest';
import {
  anAccount,
  createAuthContext,
  NEW_PASSWORD,
  VALID_PASSWORD,
  type AuthContext,
} from '../../../../../test/builders/auth-context.js';
import { InvalidResetTokenError } from '../../domain/errors/auth.errors.js';
import { WeakPasswordError } from '../../domain/value-objects/password.vo.js';
import { ChangePassword, IncorrectCurrentPasswordError } from './change-password.use-case.js';
import { CompletePasswordReset } from './complete-password-reset.use-case.js';
import { Login } from './login.use-case.js';
import { RequestPasswordReset } from './request-password-reset.use-case.js';

const signIn = (ctx: AuthContext, password = VALID_PASSWORD) =>
  new Login(ctx).execute({ email: 'alice@example.com', password, ip: null });

describe('RequestPasswordReset', () => {
  let ctx: AuthContext;
  let request: RequestPasswordReset;
  const ask = (email = 'alice@example.com') => request.execute({ email, ip: '203.0.113.9' });

  beforeEach(() => {
    ctx = createAuthContext();
    request = new RequestPasswordReset(ctx);
    ctx.accounts.add(anAccount());
  });

  it('emails a link that carries the raw token', async () => {
    await ask();

    expect(ctx.email.sent).toHaveLength(1);
    expect(ctx.email.sent[0]?.to).toBe('alice@example.com');
    expect(ctx.email.sent[0]?.subject).toBe('Reset your CMS password');
    expect(ctx.email.sent[0]?.text).toContain(
      'https://cms.example.com/reset-password?token=opaque-1',
    );
    expect(ctx.email.sent[0]?.text).toContain('60 minutes');
  });

  it('stores only the hash of the token', async () => {
    await ask();

    const [token] = [...ctx.resetTokens.tokens.values()];
    expect(token?.tokenHash).toBe('sha:opaque-1');
    expect(token?.userId).toBe('user-1');
  });

  it('invalidates earlier links when a new one is requested', async () => {
    await ask();
    await ask();

    const first = await ctx.resetTokens.findByHash('sha:opaque-1');
    const second = await ctx.resetTokens.findByHash('sha:opaque-2');
    expect(first?.isUsable(ctx.clock.now())).toBe(false);
    expect(second?.isUsable(ctx.clock.now())).toBe(true);
  });

  it('writes an audit event', async () => {
    await ask();

    expect(ctx.audit.events).toEqual([
      {
        actorId: 'user-1',
        actorIp: '203.0.113.9',
        action: 'auth.password.reset_requested',
        targetType: 'user',
        targetId: 'user-1',
        summary: {},
      },
    ]);
  });

  it.each(['nobody@example.com', 'not-an-email'])(
    'resolves without sending anything for %s',
    async (email) => {
      await expect(ask(email)).resolves.toBeUndefined();

      expect(ctx.email.sent).toEqual([]);
      expect(ctx.resetTokens.tokens.size).toBe(0);
    },
  );

  it.each(['deactivated', 'invited'] as const)(
    'resolves without sending anything for a %s account',
    async (status) => {
      ctx.accounts.add(anAccount({ status }));

      await expect(ask()).resolves.toBeUndefined();

      expect(ctx.email.sent).toEqual([]);
    },
  );

  it('hides a delivery failure from the caller and logs it by user id only', async () => {
    ctx.email.failWith = new Error('smtp down');

    await expect(ask()).resolves.toBeUndefined();

    expect(ctx.logger.errors).toEqual([
      { message: 'Password reset email failed', context: { userId: 'user-1' } },
    ]);
  });

  it('logs nothing when delivery succeeds', async () => {
    await ask();

    expect(ctx.logger.errors).toEqual([]);
  });
});

describe('CompletePasswordReset', () => {
  let ctx: AuthContext;
  let complete: CompletePasswordReset;
  const reset = (token = 'opaque-1', newPassword = NEW_PASSWORD) =>
    complete.execute({ token, newPassword, ip: '203.0.113.9' });

  beforeEach(async () => {
    ctx = createAuthContext();
    complete = new CompletePasswordReset(ctx);
    ctx.accounts.add(anAccount());
    await new RequestPasswordReset(ctx).execute({ email: 'alice@example.com', ip: null });
    ctx.audit.events.length = 0;
  });

  it('sets the new password so that it can log in', async () => {
    await reset();

    await expect(signIn(ctx, NEW_PASSWORD)).resolves.toBeDefined();
    await expect(signIn(ctx, VALID_PASSWORD)).rejects.toThrow();
  });

  it('refuses a link used a second time (FR-AUTH-08)', async () => {
    await reset();

    await expect(reset('opaque-1', 'another-pass-3')).rejects.toThrow(InvalidResetTokenError);
    await expect(signIn(ctx, NEW_PASSWORD)).resolves.toBeDefined();
  });

  it('refuses when it loses a concurrent use of the same link (FR-AUTH-08)', async () => {
    ctx.resetTokens.consumeIfUnused = () => Promise.resolve(false);

    await expect(reset()).rejects.toThrow(InvalidResetTokenError);

    await expect(signIn(ctx, VALID_PASSWORD)).resolves.toBeDefined();
    expect(ctx.audit.actions()).not.toContain('auth.password.reset_completed');
  });

  it('refuses a link after 60 minutes (FR-AUTH-07)', async () => {
    ctx.clock.advanceMinutes(60);

    await expect(reset()).rejects.toThrow(InvalidResetTokenError);
  });

  it('refuses an unknown token', async () => {
    await expect(reset('made-up')).rejects.toThrow(InvalidResetTokenError);
  });

  it('refuses a weak password and leaves the token usable', async () => {
    await expect(reset('opaque-1', 'short1')).rejects.toThrow(WeakPasswordError);

    await expect(reset()).resolves.toBeUndefined();
  });

  it('revokes existing sessions (FR-AUTH-05)', async () => {
    const session = await signIn(ctx);

    await reset();

    const stored = await ctx.refreshTokens.findByHash(`sha:${session.refreshToken}`);
    expect(stored?.state(ctx.clock.now())).toBe('revoked');
  });

  it('clears a lockout so the owner can log in straight away', async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(signIn(ctx, 'wrong-password-1')).rejects.toThrow();
    }

    await reset();

    await expect(signIn(ctx, NEW_PASSWORD)).resolves.toBeDefined();
  });

  it('writes an audit event', async () => {
    await reset();

    expect(ctx.audit.events).toEqual([
      {
        actorId: 'user-1',
        actorIp: '203.0.113.9',
        action: 'auth.password.reset_completed',
        targetType: 'user',
        targetId: 'user-1',
        summary: {},
      },
    ]);
  });

  it('applies its writes inside a transaction', async () => {
    const before = ctx.tx.runs;

    await reset();

    expect(ctx.tx.runs).toBe(before + 1);
  });

  it.each(['deactivated', 'invited'] as const)(
    'will not reactivate access for a %s account',
    async (status) => {
      ctx.accounts.add(anAccount({ status }));

      await expect(reset()).rejects.toThrow(InvalidResetTokenError);
    },
  );

  it('refuses a token whose account no longer exists', async () => {
    ctx.accounts.accounts.clear();

    await expect(reset()).rejects.toThrow(InvalidResetTokenError);
  });
});

describe('ChangePassword', () => {
  let ctx: AuthContext;
  let change: ChangePassword;
  const actor = { id: 'user-1', role: 'editor' } as const;
  const run = (currentPassword = VALID_PASSWORD, newPassword = NEW_PASSWORD) =>
    change.execute({ actor, currentPassword, newPassword, ip: '203.0.113.9' });

  beforeEach(() => {
    ctx = createAuthContext();
    change = new ChangePassword(ctx);
    ctx.accounts.add(anAccount());
  });

  it('changes the password', async () => {
    await run();

    await expect(signIn(ctx, NEW_PASSWORD)).resolves.toBeDefined();
  });

  it('refuses a wrong current password', async () => {
    await expect(run('wrong-password-1')).rejects.toThrow(IncorrectCurrentPasswordError);

    await expect(signIn(ctx, VALID_PASSWORD)).resolves.toBeDefined();
  });

  describe('guessing the current password', () => {
    const wrong = async (times: number) => {
      for (let i = 0; i < times; i += 1) {
        await expect(run('wrong-password-1')).rejects.toThrow(IncorrectCurrentPasswordError);
      }
    };

    it('audits a wrong guess', async () => {
      await wrong(1);

      expect(ctx.audit.events.at(-1)).toMatchObject({
        actorId: 'user-1',
        action: 'auth.password.change_failed',
        targetId: 'user-1',
      });
    });

    it('refuses even the right password after 5 wrong guesses', async () => {
      await wrong(5);

      await expect(run()).rejects.toThrow(IncorrectCurrentPasswordError);
    });

    it('shares the lockout with login, so guessing here cannot continue there', async () => {
      await wrong(5);

      await expect(signIn(ctx, VALID_PASSWORD)).rejects.toThrow();
    });

    it('clears the count once the right password is given', async () => {
      await wrong(4);
      await run();
      await run(NEW_PASSWORD, 'another-pass-3');

      await expect(signIn(ctx, 'another-pass-3')).resolves.toBeDefined();
    });
  });

  it('describes a wrong current password as a field error', () => {
    const error = new IncorrectCurrentPasswordError();

    expect(error.kind).toBe('validation');
    expect(error.details).toEqual({ field: 'currentPassword' });
  });

  it('refuses a weak new password', async () => {
    await expect(run(VALID_PASSWORD, 'short1')).rejects.toThrow(WeakPasswordError);
  });

  it('revokes all sessions (FR-AUTH-05)', async () => {
    const session = await signIn(ctx);

    await run();

    const stored = await ctx.refreshTokens.findByHash(`sha:${session.refreshToken}`);
    expect(stored?.state(ctx.clock.now())).toBe('revoked');
  });

  it('writes an audit event', async () => {
    await run();

    expect(ctx.audit.events.at(-1)).toEqual({
      actorId: 'user-1',
      actorIp: '203.0.113.9',
      action: 'auth.password.changed',
      targetType: 'user',
      targetId: 'user-1',
      summary: {},
    });
  });

  it('applies its writes inside a transaction', async () => {
    await run();

    expect(ctx.tx.runs).toBe(2);
  });

  it('refuses when the account has disappeared or has no password', async () => {
    ctx.accounts.accounts.clear();
    await expect(run()).rejects.toThrow(IncorrectCurrentPasswordError);

    ctx.accounts.add(anAccount({ passwordHash: null }));
    await expect(run()).rejects.toThrow(IncorrectCurrentPasswordError);
  });
});
