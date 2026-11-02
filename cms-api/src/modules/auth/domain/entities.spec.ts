import { describe, expect, it } from 'vitest';
import { Account } from './entities/account.entity.js';
import { ApiKey } from './entities/api-key.entity.js';
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { InvalidApiKeyNameError, InvalidResetTokenError } from './errors/auth.errors.js';
import { assertPasswordPolicy, WeakPasswordError } from './value-objects/password.vo.js';

const T0 = new Date('2026-05-11T10:00:00Z');
const after = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe('assertPasswordPolicy', () => {
  it.each(['abcdefghijk1', 'A1aaaaaaaaaaaaaa', '12345678901a', 'ผ่านรหัส12345a'])(
    'accepts "%s"',
    (password) => {
      expect(() => {
        assertPasswordPolicy(password);
      }).not.toThrow();
    },
  );

  it.each([
    ['11 characters', 'abcdefghij1'],
    ['no digit', 'abcdefghijkl'],
    ['no letter', '123456789012'],
    ['empty', ''],
    ['over 128 characters', `a1${'x'.repeat(127)}`],
  ])('rejects a password with %s', (_name, password) => {
    expect(() => {
      assertPasswordPolicy(password);
    }).toThrow(WeakPasswordError);
  });

  it('accepts exactly 128 characters', () => {
    expect(() => {
      assertPasswordPolicy(`a1${'x'.repeat(126)}`);
    }).not.toThrow();
  });

  it('reports a validation error on the password field without echoing the value', () => {
    const error = new WeakPasswordError();

    expect(error.kind).toBe('validation');
    expect(error.details).toEqual({ field: 'password' });
    expect(error.message).toContain('12');
  });
});

describe('Account', () => {
  const props = {
    id: 'u1',
    email: 'a@example.com',
    name: 'Alice',
    role: 'editor',
    passwordHash: 'hash',
    status: 'active',
  } as const;

  it('allows login when active with a password', () => {
    expect(new Account(props).canLogin()).toBe(true);
  });

  it.each(['deactivated', 'invited'] as const)('denies login when %s', (status) => {
    expect(new Account({ ...props, status }).canLogin()).toBe(false);
  });

  it('denies login when no password has been set', () => {
    expect(new Account({ ...props, passwordHash: null }).canLogin()).toBe(false);
  });

  it('exposes the properties it was built from', () => {
    expect(new Account(props)).toMatchObject(props);
  });
});

describe('RefreshToken', () => {
  const issue = (ttlMs = 14 * DAY) =>
    RefreshToken.issue({
      id: 't1',
      userId: 'u1',
      familyId: 'f1',
      tokenHash: 'h1',
      now: T0,
      ttlMs,
    });

  it('is active straight after issue', () => {
    const token = issue();

    expect(token.state(T0)).toBe('active');
    expect(token).toMatchObject({ id: 't1', userId: 'u1', familyId: 'f1', tokenHash: 'h1' });
    expect(token.issuedAt).toEqual(T0);
    expect(token.revokedAt).toBeNull();
  });

  it('expires after 30 minutes without use as SEC-12 requires', () => {
    const token = issue();

    expect(token.state(after(30 * MIN - 1))).toBe('active');
    expect(token.state(after(30 * MIN))).toBe('expired');
  });

  it('caps the lifetime at 14 days as FR-AUTH-04 requires', () => {
    expect(issue(30 * DAY).expiresAt).toEqual(after(14 * DAY));
  });

  it('uses a shorter lifetime when configured', () => {
    expect(issue(DAY).expiresAt).toEqual(after(DAY));
  });

  it('expires at its absolute lifetime even when recently rotated', () => {
    const rotated = issue(10 * MIN).rotate({ id: 't2', tokenHash: 'h2', now: after(9 * MIN) });

    expect(rotated.state(after(10 * MIN - 1))).toBe('active');
    expect(rotated.state(after(10 * MIN))).toBe('expired');
  });

  it('keeps the family and absolute expiry when rotated and restarts the idle clock', () => {
    const original = issue();

    const rotated = original.rotate({ id: 't2', tokenHash: 'h2', now: after(20 * MIN) });

    expect(rotated).toMatchObject({ id: 't2', familyId: 'f1', userId: 'u1', tokenHash: 'h2' });
    expect(rotated.expiresAt).toEqual(original.expiresAt);
    expect(rotated.state(after(49 * MIN))).toBe('active');
  });

  it('reports revoked once revoked, even after it would have expired', () => {
    const token = issue().revoke(after(MIN));

    expect(token.state(after(MIN))).toBe('revoked');
    expect(token.state(after(30 * DAY))).toBe('revoked');
    expect(token.revokedAt).toEqual(after(MIN));
  });

  describe('after rotation', () => {
    const rotated = () => issue().markRotated(after(MIN));

    it('is distinct from a revoked token', () => {
      expect(rotated().state(after(MIN))).toBe('rotated');
      expect(rotated().rotatedAt).toEqual(after(MIN));
      expect(rotated().revokedAt).toEqual(after(MIN));
    });

    it('stays in the grace period for just under 10 seconds', () => {
      expect(rotated().isInGracePeriod(after(MIN + 9_999))).toBe(true);
      expect(rotated().isInGracePeriod(after(MIN + 10_000))).toBe(false);
    });

    it('is outside the grace period when it was never rotated', () => {
      expect(issue().isInGracePeriod(T0)).toBe(false);
      expect(issue().revoke(T0).isInGracePeriod(T0)).toBe(false);
    });

    it('reports expired once past the family lifetime, so an ancient replay is not theft', () => {
      const short = issue(5 * MIN).markRotated(after(MIN));

      expect(short.state(after(5 * MIN - 1))).toBe('rotated');
      expect(short.state(after(5 * MIN))).toBe('expired');
    });

    it('starts its replacement clean', () => {
      const child = rotated().rotate({ id: 't2', tokenHash: 'h2', now: after(MIN) });

      expect(child.rotatedAt).toBeNull();
      expect(child.revokedAt).toBeNull();
    });
  });

  it('round-trips through persisted state', () => {
    const token = issue().revoke(after(MIN));

    expect(RefreshToken.restore({ ...token })).toEqual(token);
  });
});

describe('PasswordResetToken', () => {
  const issue = () => PasswordResetToken.issue({ id: 'r1', userId: 'u1', tokenHash: 'h', now: T0 });

  it('stays usable for just under 60 minutes as FR-AUTH-07 requires', () => {
    const token = issue();

    expect(token.isUsable(after(60 * MIN - 1))).toBe(true);
    expect(token.isUsable(after(60 * MIN))).toBe(false);
  });

  it('is unusable once used', () => {
    const used = PasswordResetToken.restore({ ...issue(), usedAt: after(MIN) });

    expect(used.isUsable(after(MIN))).toBe(false);
  });

  it('round-trips through persisted state', () => {
    const token = issue();

    expect(PasswordResetToken.restore({ ...token })).toEqual(token);
    expect(token).toMatchObject({ id: 'r1', userId: 'u1', tokenHash: 'h' });
  });

  it('describes an invalid token as a validation error', () => {
    expect(new InvalidResetTokenError().kind).toBe('validation');
  });
});

describe('ApiKey', () => {
  const create = (name = 'Production Web') =>
    ApiKey.create({
      id: 'k1',
      name,
      prefix: 'cmsk_abc',
      keyHash: 'hash',
      createdBy: 'u1',
      now: T0,
    });

  it('is active when created and has never been used', () => {
    const key = create();

    expect(key.isActive()).toBe(true);
    expect(key.lastUsedAt).toBeNull();
    expect(key.revokedAt).toBeNull();
    expect(key.createdAt).toEqual(T0);
    expect(key).toMatchObject({ id: 'k1', prefix: 'cmsk_abc', keyHash: 'hash', createdBy: 'u1' });
  });

  it('trims the label', () => {
    expect(create('  Mobile  ').name).toBe('Mobile');
  });

  it.each(['', '   ', 'x'.repeat(101)])('rejects the name "%s"', (name) => {
    expect(() => create(name)).toThrow(InvalidApiKeyNameError);
  });

  it('accepts a name of exactly 100 characters', () => {
    expect(create('x'.repeat(100)).name).toHaveLength(100);
  });

  it('is inactive once revoked', () => {
    const revoked = create().revoke(after(MIN));

    expect(revoked.isActive()).toBe(false);
    expect(revoked.revokedAt).toEqual(after(MIN));
  });

  it('keeps the first revocation time when revoked again', () => {
    const revoked = create()
      .revoke(after(MIN))
      .revoke(after(2 * MIN));

    expect(revoked.revokedAt).toEqual(after(MIN));
  });

  it('records use without touching anything else', () => {
    const used = create().markUsed(after(MIN));

    expect(used.lastUsedAt).toEqual(after(MIN));
    expect(used.isActive()).toBe(true);
    expect(used.keyHash).toBe('hash');
  });

  it('round-trips through persisted state', () => {
    const key = create().markUsed(after(MIN));

    expect(ApiKey.restore({ ...key })).toEqual(key);
  });

  it('reports a bad name as a validation error on the name field', () => {
    const error = new InvalidApiKeyNameError();

    expect(error.kind).toBe('validation');
    expect(error.details).toEqual({ field: 'name' });
  });
});
