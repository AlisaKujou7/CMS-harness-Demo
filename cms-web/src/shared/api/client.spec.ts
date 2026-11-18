import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../test/mocks/server';
import { ApiError } from './api-error';
import { api, unwrap, unwrapData } from './client';

const STATS = '*/api/admin/content/stats';

describe('the API client', () => {
  it('returns the data of a successful response', async () => {
    const stats = { draft: 1, in_review: 2, published: 3, unpublished: 4, archived: 5 };
    server.use(http.get(STATS, () => HttpResponse.json({ data: stats })));

    await expect(unwrapData(api.GET('/api/admin/content/stats'))).resolves.toEqual(stats);
  });

  it('turns an error response into an ApiError', async () => {
    server.use(
      http.get(STATS, () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'No' } }, { status: 403 }),
      ),
    );

    await expect(unwrap(api.GET('/api/admin/content/stats'))).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('turns a network failure into an ApiError', async () => {
    server.use(http.get(STATS, () => HttpResponse.error()));

    await expect(unwrap(api.GET('/api/admin/content/stats'))).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });

  it('leaves an ApiError that is already thrown as it is', async () => {
    const error = new ApiError({ status: 418, code: 'TEAPOT', message: 'm' });

    await expect(unwrap(Promise.reject(error))).rejects.toBe(error);
  });
});
