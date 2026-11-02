import { AppError } from '../../../../shared/kernel/app-error.js';

// One message for unknown users, wrong passwords, lockouts and deactivated accounts, so the client
// cannot tell them apart (FR-AUTH-06).
export class InvalidCredentialsError extends AppError {
  constructor() {
    super({
      kind: 'unauthorized',
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect, or the account is unavailable',
    });
  }
}

export class InvalidRefreshTokenError extends AppError {
  constructor() {
    super({ kind: 'unauthorized', code: 'INVALID_SESSION', message: 'Please sign in again' });
  }
}

export class InvalidAccessTokenError extends AppError {
  constructor() {
    super({ kind: 'unauthorized', code: 'UNAUTHENTICATED', message: 'Authentication is required' });
  }
}

export class InvalidApiKeyError extends AppError {
  constructor() {
    super({
      kind: 'unauthorized',
      code: 'INVALID_API_KEY',
      message: 'A valid API key is required',
    });
  }
}

export class InvalidResetTokenError extends AppError {
  constructor() {
    super({
      kind: 'validation',
      code: 'INVALID_RESET_TOKEN',
      message: 'This link is invalid or has expired',
      details: { field: 'token' },
    });
  }
}

export class InvalidApiKeyNameError extends AppError {
  constructor() {
    super({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      message: 'Name must be between 1 and 100 characters',
      details: { field: 'name' },
    });
  }
}

export class ApiKeyNotFoundError extends AppError {
  constructor() {
    super({ kind: 'not_found', code: 'NOT_FOUND', message: 'API key not found' });
  }
}
