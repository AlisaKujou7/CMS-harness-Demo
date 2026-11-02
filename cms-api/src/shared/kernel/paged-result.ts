import { AppError } from './app-error.js';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface PagedResult<T> extends PageRequest {
  readonly items: readonly T[];
  readonly total: number;
  readonly totalPages: number;
}

export class InvalidPageRequestError extends AppError {
  constructor(field: string, value: number) {
    super({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      message: `${field} must be a positive integer, got ${String(value)}`,
      details: { field },
    });
  }
}

function requirePositiveInteger(field: string, value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new InvalidPageRequestError(field, value);
  return value;
}

export function toPageRequest(input: { page?: number; pageSize?: number }): PageRequest {
  const page = requirePositiveInteger('page', input.page ?? 1);
  const pageSize = requirePositiveInteger('pageSize', input.pageSize ?? DEFAULT_PAGE_SIZE);
  return { page, pageSize: Math.min(pageSize, MAX_PAGE_SIZE) };
}

export function pagedResult<T>(
  items: readonly T[],
  total: number,
  request: PageRequest,
): PagedResult<T> {
  return { items, ...request, total, totalPages: Math.ceil(total / request.pageSize) };
}
