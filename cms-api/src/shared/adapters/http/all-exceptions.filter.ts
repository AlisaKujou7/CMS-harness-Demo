import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppError, type ErrorKind, RateLimitedError } from '../../kernel/app-error.js';
import type { Logger } from '../../ports/system.port.js';

const STATUS_BY_KIND: Readonly<Record<ErrorKind, number>> = {
  validation: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
};

const CODE_BY_STATUS: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
};

interface ErrorBody {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

// Maps every failure to the standard envelope (02-SRS 7.4) and never leaks internals on a 500.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof AppError) {
      this.sendAppError(response, exception);
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = CODE_BY_STATUS[status] ?? `HTTP_${String(status)}`;
      send(response, status, { code, message: exception.message });
      return;
    }
    this.logger.error('Unhandled error', {
      requestId: response.getHeader('x-request-id'),
      error: exception instanceof Error ? exception.message : String(exception),
    });
    send(response, 500, { code: 'INTERNAL_ERROR', message: 'Something went wrong' });
  }

  private sendAppError(response: Response, error: AppError): void {
    if (error instanceof RateLimitedError) {
      response.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    const body: ErrorBody = { code: error.code, message: error.message };
    send(
      response,
      STATUS_BY_KIND[error.kind],
      error.details ? { ...body, details: error.details } : body,
    );
  }
}

function send(response: Response, status: number, error: ErrorBody): void {
  response.status(status).json({ error });
}
