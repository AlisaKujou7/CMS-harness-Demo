import { AppError } from '../../../../shared/kernel/app-error.js';

export class MediaNotFoundError extends AppError {
  constructor() {
    super({ kind: 'not_found', code: 'NOT_FOUND', message: 'Media not found' });
  }
}

export class InvalidMediaError extends AppError {
  constructor(field: string, message: string) {
    super({ kind: 'validation', code: 'VALIDATION_ERROR', message, details: { field } });
  }
}

// FR-MEDIA-03: type, extension and content must all agree with the allow-list.
export class UnsupportedMediaTypeError extends AppError {
  constructor(reason: string) {
    super({
      kind: 'validation',
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: `This file cannot be uploaded: ${reason}`,
    });
  }
}

export class FileTooLargeError extends AppError {
  constructor(maxBytes: number) {
    super({
      kind: 'validation',
      code: 'FILE_TOO_LARGE',
      message: 'This file is larger than the upload limit',
      details: { max_bytes: maxBytes },
    });
  }
}

export class UploadNotFoundError extends AppError {
  constructor() {
    super({
      kind: 'not_found',
      code: 'UPLOAD_NOT_FOUND',
      message: 'No uploaded file was found. It may have expired, so upload it again',
    });
  }
}

// The file changed after it was checked, which only a deliberate second upload would do.
export class UploadChangedError extends AppError {
  constructor() {
    super({
      kind: 'conflict',
      code: 'UPLOAD_CHANGED',
      message: 'The uploaded file changed while it was being checked. Upload it again',
    });
  }
}

export class MediaAlreadyExistsError extends AppError {
  constructor() {
    super({ kind: 'conflict', code: 'MEDIA_EXISTS', message: 'This upload was already finalized' });
  }
}

export class MediaInUseError extends AppError {
  constructor(usageCount: number) {
    super({
      kind: 'conflict',
      code: 'MEDIA_IN_USE',
      message: 'This media is used by content, so it cannot be deleted',
      details: { usage_count: usageCount },
    });
  }
}
