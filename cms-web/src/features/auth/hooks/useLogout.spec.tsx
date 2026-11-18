import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { Providers, signIn } from '../../../../test/utils/render-with-providers';
import { useSessionStore } from '../../../shared/stores/session.store';
import { useLogout } from './useLogout';

const LOGOUT = '*/api/admin/auth/logout';

describe('useLogout', () => {
  it('tells the server, with the header its CSRF guard asks for', async () => {
    let header: string | null = null;
    server.use(
      http.post(LOGOUT, ({ request }) => {
        header = request.headers.get('X-Requested-With');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    signIn();
    const { result } = renderHook(() => useLogout(), { wrapper: Providers });

    await result.current();

    expect(header).toBe('cms-admin');
    expect(useSessionStore.getState()).toMatchObject({ status: 'anonymous', accessToken: null });
  });

  it('ends the session here even if the server cannot be told', async () => {
    server.use(http.post(LOGOUT, () => HttpResponse.error()));
    signIn();
    const { result } = renderHook(() => useLogout(), { wrapper: Providers });

    await result.current();

    expect(useSessionStore.getState().status).toBe('anonymous');
  });
});
