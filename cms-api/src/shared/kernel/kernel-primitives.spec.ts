import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canManageSystem, type Actor } from './actor.js';
import { AppError, ForbiddenError } from './app-error.js';
import { Email, InvalidEmailError } from './email.js';

describe('AppError', () => {
  it('carries the kind, code, message and details used by the HTTP error mapper', () => {
    const error = new AppError({
      kind: 'conflict',
      code: 'SLUG_TAKEN',
      message: 'Slug already exists',
      details: { field: 'slug' },
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe('conflict');
    expect(error.code).toBe('SLUG_TAKEN');
    expect(error.message).toBe('Slug already exists');
    expect(error.details).toEqual({ field: 'slug' });
  });

  it('has no details unless they are given', () => {
    const error = new AppError({ kind: 'not_found', code: 'X', message: 'y' });

    expect(error.details).toBeUndefined();
  });

  it('reports the concrete class as its name', () => {
    expect(new ForbiddenError().name).toBe('ForbiddenError');
  });
});

describe('ForbiddenError', () => {
  it('uses a generic body as FR-AUTHZ-05 requires', () => {
    const error = new ForbiddenError();

    expect(error.kind).toBe('forbidden');
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('You do not have permission to perform this action');
  });
});

describe('canManageSystem', () => {
  it.each([
    ['admin', true],
    ['editor', false],
    ['author', false],
  ] as const)('for %s is %s', (role, expected) => {
    const actor: Actor = { id: 'u1', role };

    expect(canManageSystem(actor)).toBe(expected);
  });
});

describe('Email', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(Email.create('  Alice@Example.COM ').value).toBe('alice@example.com');
  });

  it.each(['a@b.co', 'first.last+tag@sub.example.com', "o'neil@example.org"])(
    'accepts %s',
    (input) => {
      expect(Email.create(input).value).toBe(input.toLowerCase());
    },
  );

  it.each([
    '',
    'no-at-sign',
    '@example.com',
    'a@',
    'a@b',
    'a b@example.com',
    'a@b@example.com',
    'a@-example.com',
    'a..b@example.com',
    '.a@example.com',
    'a.@example.com',
  ])('rejects "%s"', (input) => {
    expect(() => Email.create(input)).toThrow(InvalidEmailError);
  });

  it('accepts an address of exactly 254 characters and rejects 255', () => {
    const domain = '@example.com';
    const atLimit = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(58)}.co`;

    expect(atLimit).toHaveLength(254);
    expect(Email.create(atLimit).value).toBe(atLimit);
    expect(() => Email.create(`a${atLimit}`)).toThrow(InvalidEmailError);
    expect(() => Email.create(`${'a'.repeat(65)}${domain}`)).toThrow(InvalidEmailError);
  });

  it('reports the failure as a validation error on the email field', () => {
    const error = new InvalidEmailError();

    expect(error.kind).toBe('validation');
    expect(error.details).toEqual({ field: 'email' });
  });

  it('is idempotent for any accepted address', () => {
    fc.assert(
      fc.property(fc.emailAddress({ size: 'small' }), (raw) => {
        const once = Email.create(raw).value;

        expect(Email.create(once).value).toBe(once);
      }),
    );
  });

  it('parses without throwing', () => {
    expect(Email.parse(' A@example.com ')?.value).toBe('a@example.com');
    expect(Email.parse('nope')).toBeNull();
  });

  it('compares by normalized value', () => {
    expect(Email.create('A@example.com').equals(Email.create('a@example.com'))).toBe(true);
    expect(Email.create('a@example.com').equals(Email.create('b@example.com'))).toBe(false);
  });
});
