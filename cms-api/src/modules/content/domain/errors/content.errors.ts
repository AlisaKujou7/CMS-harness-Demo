import { AppError } from '../../../../shared/kernel/app-error.js';

export class ContentNotFoundError extends AppError {
  constructor() {
    super({ kind: 'not_found', code: 'NOT_FOUND', message: 'Content not found' });
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super({
      kind: 'conflict',
      code: 'INVALID_TRANSITION',
      message: `Content cannot move from ${from} to ${to}`,
      details: { from, to },
    });
  }
}

export class MissingRequiredFieldsError extends AppError {
  constructor(fields: readonly string[]) {
    super({
      kind: 'validation',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'Content is missing what it needs to be published',
      details: { fields },
    });
  }
}

export class InvalidContentError extends AppError {
  constructor(field: string, message: string) {
    super({ kind: 'validation', code: 'VALIDATION_ERROR', message, details: { field } });
  }
}

export class InvalidSlugError extends AppError {
  constructor() {
    super({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      message: 'Slug may use lowercase letters, digits and single hyphens, up to 200 characters',
      details: { field: 'slug' },
    });
  }
}

export class SlugConflictError extends AppError {
  constructor() {
    super({
      kind: 'conflict',
      code: 'SLUG_TAKEN',
      message: 'Slug already exists for this content type',
      details: { field: 'slug' },
    });
  }
}

export class InvalidScheduleError extends AppError {
  constructor() {
    super({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      message: 'Scheduled time must be in the future',
      details: { field: 'scheduled_at' },
    });
  }
}

export class MissingMediaError extends AppError {
  constructor(ids: readonly string[]) {
    super({
      kind: 'validation',
      code: 'MEDIA_NOT_FOUND',
      message: 'This content refers to media that does not exist',
      details: { ids },
    });
  }
}

// Every content field that references media shows it as an image, so a PDF would render broken.
export class MediaNotImageError extends AppError {
  constructor(ids: readonly string[]) {
    super({
      kind: 'validation',
      code: 'MEDIA_NOT_IMAGE',
      message: 'This content uses a file that is not an image as an image',
      details: { ids },
    });
  }
}

// An Editor approved what is scheduled, so changing it would publish text nobody reviewed.
export class ContentScheduledError extends AppError {
  constructor() {
    super({
      kind: 'conflict',
      code: 'CONTENT_SCHEDULED',
      message: 'This content is scheduled to publish. Ask an Editor to cancel the schedule first',
    });
  }
}

// Someone else saved first. The editor shows this as the conflict dialog in 03-DESIGN 19.4.
export class ConcurrentModificationError extends AppError {
  constructor() {
    super({
      kind: 'conflict',
      code: 'CONTENT_CHANGED',
      message: 'This content was changed by someone else. Reload to see the latest version',
    });
  }
}
