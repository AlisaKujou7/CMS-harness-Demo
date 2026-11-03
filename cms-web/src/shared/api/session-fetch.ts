import { useSessionStore } from '../stores/session.store';
import type { AuthSession } from './types';

const REFRESH_PATH = '/api/admin/auth/refresh';
const LOCK_NAME = 'cms-session-refresh';
// A wrong password is a 401 too, and these routes are how a session begins or ends.
const NO_REFRESH =
  /\/api\/admin\/auth\/(login|refresh|logout|password\/forgot|password\/reset|invitations\/accept)$/;

export function apiOrigin(): string {
  const configured: unknown = import.meta.env['VITE_PUBLIC_API_URL'];
  return typeof configured === 'string' && configured !== '' ? configured : window.location.origin;
}

// Another tab may be rotating the same cookie, so tabs take turns and each sends the latest one.
function withRefreshLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = (navigator as Partial<Navigator>).locks;
  return locks ? locks.request(LOCK_NAME, work) : work();
}

async function requestNewSession(): Promise<string | null> {
  const store = useSessionStore.getState();
  try {
    const response = await fetch(`${apiOrigin()}${REFRESH_PATH}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'cms-admin' },
    });
    if (!response.ok) {
      store.end();
      return null;
    }
    const { data } = (await response.json()) as { data: AuthSession };
    store.start(data);
    return data.access_token;
  } catch {
    store.end();
    return null;
  }
}

let refreshing: Promise<string | null> | null = null;

// Rotation treats a replayed cookie as theft, so concurrent callers must share one request.
export function refreshSession(): Promise<string | null> {
  refreshing ??= withRefreshLock(requestNewSession).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function withAuth(request: Request, token: string | null): Request {
  const next = new Request(request);
  if (token !== null) next.headers.set('Authorization', `Bearer ${token}`);
  next.headers.set('X-Request-Id', crypto.randomUUID());
  return next;
}

// 04-ARCH 6.3: send the access token, and on a 401 refresh once and try again.
export async function sessionFetch(request: Request): Promise<Response> {
  const retry = request.clone();
  const { accessToken } = useSessionStore.getState();
  const response = await fetch(withAuth(request, accessToken));
  if (response.status !== 401 || NO_REFRESH.test(new URL(request.url).pathname)) return response;

  const token = await refreshSession();
  return token === null ? response : fetch(withAuth(retry, token));
}
