import { AppError } from '../../../../shared/kernel/app-error.js';

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

export class WeakPasswordError extends AppError {
  constructor() {
    super({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      message: `Password must be ${String(MIN_LENGTH)} to ${String(MAX_LENGTH)} characters with at least one letter and one digit`,
      details: { field: 'password' },
    });
  }
}

// FR-AUTH-02. The upper bound keeps hashing cost bounded. Letters include any script.
export function assertPasswordPolicy(password: string): void {
  const validLength = password.length >= MIN_LENGTH && password.length <= MAX_LENGTH;
  if (!validLength || !/\p{L}/u.test(password) || !/\d/.test(password)) {
    throw new WeakPasswordError();
  }
}
