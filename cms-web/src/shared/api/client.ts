import createClient from 'openapi-fetch';
import { ApiError, networkError, toApiError } from './api-error';
import type { paths } from './schema.generated';
import { apiOrigin, sessionFetch } from './session-fetch';

// 04-ARCH 5.5.2: the API gateway. Features call this, and components never see HTTP.
export const api = createClient<paths>({
  baseUrl: apiOrigin(),
  fetch: (request) => sessionFetch(request),
});

interface ApiResult<T> {
  readonly data?: T;
  readonly error?: unknown;
  readonly response: Response;
}

export async function unwrap<T>(call: Promise<ApiResult<T>>): Promise<T> {
  let result: ApiResult<T>;
  try {
    result = await call;
  } catch (error) {
    throw error instanceof ApiError ? error : networkError(error);
  }
  if (!result.response.ok) throw toApiError(result.error, result.response);
  return result.data as T;
}

export async function unwrapData<T>(call: Promise<ApiResult<{ data: T }>>): Promise<T> {
  return (await unwrap(call)).data;
}

export const CSRF_HEADER = { 'X-Requested-With': 'cms-admin' } as const;
