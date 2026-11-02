import { AppError } from '../../../../shared/kernel/app-error.js';

export class UserNotFoundError extends AppError {
  constructor() {
    super({ kind: 'not_found', code: 'NOT_FOUND', message: 'User not found' });
  }
}

export class EmailTakenError extends AppError {
  constructor() {
    super({
      kind: 'conflict',
      code: 'EMAIL_TAKEN',
      message: 'A user with this email already exists',
      details: { field: 'email' },
    });
  }
}

export class LastAdminError extends AppError {
  constructor() {
    super({
      kind: 'conflict',
      code: 'LAST_ADMIN',
      message: 'The system must keep at least one active Admin',
    });
  }
}

export class UserInUseError extends AppError {
  constructor() {
    super({
      kind: 'conflict',
      code: 'USER_IN_USE',
      message: 'This user is still referenced by other records. Deactivate the user instead',
    });
  }
}

export class UserNotInvitedError extends AppError {
  constructor() {
    super({
      kind: 'conflict',
      code: 'USER_NOT_INVITED',
      message: 'This user has already accepted the invitation',
    });
  }
}

export class InvalidUserNameError extends AppError {
  constructor() {
    super({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      message: 'Name must be between 1 and 200 characters',
      details: { field: 'name' },
    });
  }
}
