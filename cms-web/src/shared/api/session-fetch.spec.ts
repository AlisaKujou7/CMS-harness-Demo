import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../test/mocks/server';
import { useSessionStore } from '../stores/session.store';
import { apiOrigin, refreshSession, sessionFetch } from './session-fetch';

const user = { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin' };
const session = { access_token: 'new-token', expires_in: 900, user };
const ME = `${window.location.origin}/api/admin/auth/me`;
const REFRESH = '*/api/admin/auth/refresh';
const get = (url = ME) => sessionFetch(new Request(url));

function respondWithBearer() {
  server.use(
    http.get(ME, ({ request }) => {
      const header = request.headers.get('Authorization');
      return header === 'Bearer new-token'
        ? HttpResponse.json({ header, id: request.headers.get('X-Request-Id') })
        : new HttpResponse(null, { status: 401 });
    }),
  );
}

describe('sessionFetch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends the access token and a request id', async () => {
    useSessionStore.setState({ accessToken: 'new-token' });
    respondWithBearer();

    const body = (await (await get()).json()) as { header: string; id: string };

    expect(body.header).toBe('Bearer new-token');
    expect(body.id).toMatch(/^[\w-]{36}$/);
  });

  it('sends no Authorization header without a token', async () => {
    let header: string | null = 'unset';
    server.use(
      http.get(ME, ({ request }) => {
        header = request.headers.get('Authorization');
        return HttpResponse.json({});
      }),
    );

    await get();

    expect(header).toBeNull();
  });

  it('refreshes once on a 401 and repeats the request', async () => {
    useSessionStore.setState({ accessToken: 'expired' });
    respondWithBearer();
    server.use(http.post(REFRESH, () => HttpResponse.json({ data: session })));

    const response = await get();

    expect(response.status).toBe(200);
    expect(useSessionStore.getState()).toMatchObject({ status: 'authenticated', user });
  });

  it('repeats a request with a body', async () => {
    useSessionStore.setState({ accessToken: 'expired' });
    server.use(
      http.post(REFRESH, () => HttpResponse.json({ data: session })),
      http.post(ME, async ({ request }) =>
        request.headers.get('Authorization') === 'Bearer new-token'
          ? HttpResponse.json(await request.json())
          : new HttpResponse(null, { status: 401 }),
      ),
    );

    const response = await sessionFetch(
      new Request(ME, { method: 'POST', body: JSON.stringify({ a: 1 }) }),
    );

    await expect(response.json()).resolves.toEqual({ a: 1 });
  });

  it('ends the session when the refresh is refused', async () => {
    useSessionStore.setState({ status: 'authenticated', accessToken: 'expired' });
    respondWithBearer();
    server.use(http.post(REFRESH, () => new HttpResponse(null, { status: 401 })));

    const response = await get();

    expect(response.status).toBe(401);
    expect(useSessionStore.getState()).toMatchObject({ status: 'anonymous', accessToken: null });
  });

  it.each([
    ['a network failure', () => HttpResponse.error()],
    ['a server error', () => new HttpResponse(null, { status: 503 })],
  ])(
    'keeps a live session through %s, and fails the request so it can retry',
    async (_n, reply) => {
      useSessionStore.setState({ status: 'authenticated', accessToken: 'expired' });
      respondWithBearer();
      server.use(http.post(REFRESH, reply));

      await expect(get()).rejects.toThrow('could not be refreshed');

      expect(useSessionStore.getState()).toMatchObject({
        status: 'authenticated',
        accessToken: 'expired',
      });
    },
  );

  it('shows sign-in when an outage hits before any session is known', async () => {
    server.use(http.post(REFRESH, () => HttpResponse.error()));

    await expect(refreshSession()).resolves.toEqual({ kind: 'unavailable' });

    expect(useSessionStore.getState().status).toBe('anonymous');
  });

  it.each([
    'login',
    'refresh',
    'logout',
    'password/forgot',
    'password/reset',
    'invitations/accept',
  ])('does not refresh for a 401 from %s', async (path) => {
    const refresh = vi.fn();
    const url = `${window.location.origin}/api/admin/auth/${path}`;
    server.use(
      http.get(url, () => new HttpResponse(null, { status: 401 })),
      http.post(REFRESH, () => {
        refresh();
        return new HttpResponse(null, { status: 401 });
      }),
    );

    await get(url);

    expect(refresh).not.toHaveBeenCalled();
  });

  it('shares one refresh between concurrent callers, and refreshes anew afterwards', async () => {
    let calls = 0;
    server.use(
      http.post(REFRESH, () => {
        calls += 1;
        return HttpResponse.json({ data: session });
      }),
    );

    await Promise.all([refreshSession(), refreshSession()]);
    expect(calls).toBe(1);

    await refreshSession();
    expect(calls).toBe(2);
  });

  it('asks the X-Requested-With guard to let the refresh through', async () => {
    let header: string | null = null;
    server.use(
      http.post(REFRESH, ({ request }) => {
        header = request.headers.get('X-Requested-With');
        return HttpResponse.json({ data: session });
      }),
    );

    await refreshSession();

    expect(header).toBe('cms-admin');
  });

  it('takes turns with other tabs when the browser offers locks', async () => {
    const request = vi.fn((_name: string, work: () => Promise<unknown>) => work());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    server.use(http.post(REFRESH, () => HttpResponse.json({ data: session })));

    await expect(refreshSession()).resolves.toEqual({ kind: 'refreshed', token: 'new-token' });

    expect(request).toHaveBeenCalledWith('cms-session-refresh', expect.any(Function));
  });

  it('uses the configured API origin when there is one', () => {
    expect(apiOrigin()).toBe(window.location.origin);

    vi.stubEnv('VITE_PUBLIC_API_URL', 'https://api.example.com');

    expect(apiOrigin()).toBe('https://api.example.com');
  });
});
