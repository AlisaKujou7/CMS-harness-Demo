import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anAccount } from '../../../../test/builders/auth-context.js';
import {
  createFakeInfrastructure,
  createTestApp,
  http,
  type FakeInfrastructure,
} from '../../../../test/builders/http-app.js';

const ARTICLES = '/api/v1/articles';
const MEDIA = '/api/admin/media';

describe('request log (NFR-OBS-01, SEC-14)', () => {
  let infra: FakeInfrastructure;
  let app: INestApplication;

  const requestLogs = () =>
    infra.logger.infos.filter((entry) => entry.message === 'request').map((entry) => entry.context);

  // The log is written once the response has closed, which can be after the client has read it.
  const oneRequestLog = async () => {
    await vi.waitFor(() => {
      expect(requestLogs()).toHaveLength(1);
    });
    return requestLogs()[0];
  };

  beforeEach(async () => {
    infra = createFakeInfrastructure();
    app = await createTestApp(infra);
  });

  afterEach(() => app.close());

  it('records the request, and matches the id the client received', async () => {
    const response = await http(app).get(ARTICLES);

    const log = await oneRequestLog();
    expect(log).toMatchObject({
      request_id: response.headers['x-request-id'],
      method: 'GET',
      path: ARTICLES,
      status: 401,
    });
    expect(log?.['duration_ms']).toEqual(expect.any(Number));
    expect(log?.['duration_ms']).toBeGreaterThanOrEqual(0);
  });

  it('names the signed-in user', async () => {
    infra.accounts.add(anAccount({ id: 'user-1', email: 'user-1@example.com', role: 'admin' }));
    const token = await infra.signer.sign({ userId: 'user-1', role: 'admin' }, 900);

    await http(app).get(MEDIA).set('Authorization', `Bearer ${token}`).expect(200);

    expect(await oneRequestLog()).toMatchObject({ user_id: 'user-1', status: 200 });
  });

  it('holds only the agreed fields, so no email, IP, key or token can reach it', async () => {
    await http(app).get(ARTICLES).set('X-API-Key', 'secret-key');

    const log = await oneRequestLog();
    expect(Object.keys(log ?? {}).sort()).toEqual([
      'duration_ms',
      'method',
      'path',
      'request_id',
      'status',
    ]);
    expect(JSON.stringify(log)).not.toContain('secret-key');
  });

  it('leaves out the query string, which can hold anything', async () => {
    await http(app).get(`${ARTICLES}?tag=secret-value`);

    const log = await oneRequestLog();
    expect(log?.['path']).toBe(ARTICLES);
    expect(JSON.stringify(log)).not.toContain('secret-value');
  });

  it('records a route that does not exist', async () => {
    await http(app).get('/nothing-here').expect(404);

    expect(await oneRequestLog()).toMatchObject({ path: '/nothing-here', status: 404 });
  });

  it.each(['/healthz', '/readyz'])(
    'skips %s, which health checks call constantly',
    async (path) => {
      await http(app).get(path).expect(200);
      await http(app).get(ARTICLES);

      expect(await oneRequestLog()).toMatchObject({ path: ARTICLES });
    },
  );
});
