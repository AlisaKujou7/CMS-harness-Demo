import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/api-error';
import { common } from '../i18n/common.messages';
import { errorToMessage } from './global-errors.stream';

const anError = (status: number, retryAfterSec: number | null = null) =>
  new ApiError({ status, code: 'X', message: 'From the server', retryAfterSec });

describe('errorToMessage (04-ARCH 6.4)', () => {
  it.each([
    [anError(0), common.errors.network],
    [anError(403), common.errors.forbidden],
    [anError(429), common.errors.rateLimitedSoon],
    [anError(429, 30), 'Too many requests. Try again in 30 seconds.'],
    [anError(500), common.errors.server],
    [anError(503), common.errors.server],
    [anError(409), 'From the server'],
    [anError(499), 'From the server'],
    [new Error('other'), common.errors.server],
  ])('maps %o', (error, message) => {
    expect(errorToMessage(error)).toBe(message);
  });
});
