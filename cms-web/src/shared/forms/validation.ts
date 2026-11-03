import { z } from 'zod';
import { ApiError } from '../api/api-error';
import { formMessages as m } from './forms.messages';

export const emailField = z.string().trim().min(1, m.required).pipe(z.email(m.invalidEmail));

// FR-AUTH-02
export const newPasswordField = z
  .string()
  .min(12, m.passwordTooShort)
  .refine((value) => /\p{L}/u.test(value) && /\d/.test(value), m.passwordNeedsLetterAndDigit);

interface SetFieldError<F extends string> {
  (name: F, error: { type: string; message: string }, options?: { shouldFocus: boolean }): void;
}

// 03-DESIGN 13.1: the server is authoritative, and its errors land on the field they name.
export function applyServerFieldError<F extends string>(
  error: unknown,
  fields: Readonly<Record<string, F>>,
  setError: SetFieldError<F>,
): boolean {
  if (!(error instanceof ApiError) || error.field === null) return false;
  const name = fields[error.field];
  if (name === undefined) return false;
  setError(name, { type: 'server', message: error.message }, { shouldFocus: true });
  return true;
}
