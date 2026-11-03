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

export type RefreshOutcome =
  | { readonly kind: 'refreshed'; readonly token: string }
  | { readonly kind: 'ended' }
  | { readonly kind: 'unavailable' };

// Only a refusal says the session is over. An outage says nothing about it, so an open editor stays
// open and retries. Before any session is known there is nothing to keep, so that shows sign-in.
function unavailable(): RefreshOutcome {
  const store = useSessionStore.getState();
  if (store.status === 'loading') store.end();
  return { kind: 'unavailable' };
}

async function requestNewSession(): Promise<RefreshOutcome> {
  const store = useSessionStore.getState();
  try {
    const response = await fetch(`${apiOrigin()}${REFRESH_PATH}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'cms-admin' },
    });
    if (response.status === 401) {
      store.end();
      return { kind: 'ended' };
    }
    if (!response.ok) return unavailable();
    const { data } = (await response.json()) as { data: AuthSession };
    store.start(data);
    return { kind: 'refreshed', token: data.access_token };
  } catch {
    return unavailable();
  }
}

let refreshing: Promise<RefreshOutcome> | null = null;

// Rotation treats a replayed cookie as theft, so concurrent callers must share one request.
export function refreshSession(): Promise<RefreshOutcome> {
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

  const outcome = await refreshSession();
  if (outcome.kind === 'ended') return response;
  // Reported as a failed request, which callers already treat as worth trying again.
  if (outcome.kind === 'unavailable') throw new TypeError('The session could not be refreshed');
  return fetch(withAuth(retry, outcome.token));
}
