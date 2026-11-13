import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/api-error';
import { applyServerFieldError, emailField, newPasswordField } from './validation';

describe('emailField', () => {
  it('accepts an address and trims it', () => {
    expect(emailField.parse('  a@example.com ')).toBe('a@example.com');
  });

  it.each([
    ['', 'This field is required'],
    ['nope', 'Enter a valid email address'],
  ])('refuses %j', (value, message) => {
    expect(emailField.safeParse(value).error?.issues[0]?.message).toBe(message);
  });
});

describe('newPasswordField (FR-AUTH-02)', () => {
  it('accepts 12 characters with a letter and a digit', () => {
    expect(newPasswordField.safeParse('abcdefghijk1').success).toBe(true);
  });

  it.each([
    ['abcdefghij1', 'Use at least 12 characters'],
    ['abcdefghijkl', 'Use at least one letter and one digit'],
    ['123456789012', 'Use at least one letter and one digit'],
  ])('refuses %s', (value, message) => {
    expect(newPasswordField.safeParse(value).error?.issues[0]?.message).toBe(message);
  });
});

describe('applyServerFieldError', () => {
  const fields = { slug: 'slug' } as const;
  const conflict = (details: Record<string, unknown>) =>
    new ApiError({ status: 409, code: 'SLUG_TAKEN', message: 'Taken', details });

  it('puts the message on the field the server named', () => {
    const setError = vi.fn();

    expect(applyServerFieldError(conflict({ field: 'slug' }), fields, setError)).toBe(true);
    expect(setError).toHaveBeenCalledWith(
      'slug',
      { type: 'server', message: 'Taken' },
      { shouldFocus: true },
    );
  });

  it.each([
    ['an unknown field', conflict({ field: 'other' })],
    ['no field', conflict({})],
    ['another kind of error', new Error('x')],
  ])('declines %s', (_name, error) => {
    const setError = vi.fn();

    expect(applyServerFieldError(error, fields, setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
