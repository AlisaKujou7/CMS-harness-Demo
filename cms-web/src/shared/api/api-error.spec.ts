import { describe, expect, it } from 'vitest';
import { ApiError, hasCode, hasStatus, isRetryable, networkError, toApiError } from './api-error';

const anError = (status: number, code = 'X') => new ApiError({ status, code, message: 'm' });

describe('ApiError', () => {
  it('reads the standard envelope and the response headers', () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'X-Request-Id': 'r1', 'Retry-After': '30' },
    });

    const error = toApiError(
      { error: { code: 'RATE_LIMITED', message: 'Slow', details: { field: 'slug' } } },
      response,
    );

    expect(error).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Slow',
      requestId: 'r1',
      retryAfterSec: 30,
      field: 'slug',
    });
  });

  it('copes with a body that is not the envelope', () => {
    const response = new Response(null, { status: 502, statusText: 'Bad Gateway' });

    expect(toApiError('upstream down', response)).toMatchObject({
      status: 502,
      code: 'UNKNOWN',
      message: 'Bad Gateway',
      details: {},
      requestId: null,
      retryAfterSec: null,
      field: null,
    });
  });

  it.each(['abc', '0', '-1'])('ignores a Retry-After of %s', (value) => {
    const response = new Response(null, { status: 429, headers: { 'Retry-After': value } });

    expect(toApiError({}, response).retryAfterSec).toBeNull();
  });

  it('describes a network failure from any cause', () => {
    expect(networkError(new TypeError('offline'))).toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'offline',
    });
    expect(networkError('boom').message).toBe('boom');
  });

  it('treats only network failures and 5xx as worth retrying', () => {
    expect(isRetryable(networkError('x'))).toBe(true);
    expect(isRetryable(anError(500))).toBe(true);
    expect(isRetryable(anError(499))).toBe(false);
    expect(isRetryable(new Error('other'))).toBe(false);
  });

  it('matches on status and code only for an ApiError', () => {
    expect(hasStatus(anError(404), 404)).toBe(true);
    expect(hasStatus(anError(404), 403)).toBe(false);
    expect(hasStatus(new Error('x'), 404)).toBe(false);
    expect(hasCode(anError(409, 'SLUG_TAKEN'), 'SLUG_TAKEN')).toBe(true);
    expect(hasCode(anError(409, 'SLUG_TAKEN'), 'OTHER')).toBe(false);
    expect(hasCode(new Error('x'), 'X')).toBe(false);
  });
});
