const NETWORK_STATUS = 0;

export interface ApiErrorFields {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly requestId?: string | null;
  readonly retryAfterSec?: number | null;
}

// The error envelope in 02-SRS 7.4, plus what the response headers add to it.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly requestId: string | null;
  readonly retryAfterSec: number | null;

  constructor(fields: ApiErrorFields) {
    super(fields.message);
    this.name = 'ApiError';
    this.status = fields.status;
    this.code = fields.code;
    this.details = fields.details ?? {};
    this.requestId = fields.requestId ?? null;
    this.retryAfterSec = fields.retryAfterSec ?? null;
  }

  get field(): string | null {
    const { field } = this.details;
    return typeof field === 'string' ? field : null;
  }
}

export function networkError(cause: unknown): ApiError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return new ApiError({ status: NETWORK_STATUS, code: 'NETWORK_ERROR', message });
}

export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === NETWORK_STATUS || error.status >= 500);
}

export function hasStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

export function hasCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}

interface ErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}

function retryAfter(response: Response): number | null {
  const seconds = Number(response.headers.get('Retry-After'));
  return Number.isInteger(seconds) && seconds > 0 ? seconds : null;
}

export function toApiError(body: unknown, response: Response): ApiError {
  const { error } = (typeof body === 'object' && body !== null ? body : {}) as ErrorBody;
  return new ApiError({
    status: response.status,
    code: error?.code ?? 'UNKNOWN',
    message: error?.message ?? response.statusText,
    details: error?.details ?? {},
    requestId: response.headers.get('X-Request-Id'),
    retryAfterSec: retryAfter(response),
  });
}
