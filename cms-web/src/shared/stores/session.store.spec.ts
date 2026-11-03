import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCurrentUser, useSessionStore } from './session.store';

const user = { id: 'u1', email: 'a@b.c', name: 'A', role: 'editor' } as const;

describe('session store', () => {
  it('starts and ends a session', () => {
    useSessionStore.getState().start({ access_token: 't', expires_in: 900, user });

    expect(useSessionStore.getState()).toMatchObject({
      status: 'authenticated',
      accessToken: 't',
      user,
    });

    useSessionStore.getState().end();

    expect(useSessionStore.getState()).toMatchObject({
      status: 'anonymous',
      accessToken: null,
      user: null,
    });
  });

  it('gives the current user to a signed-in screen', () => {
    useSessionStore.getState().start({ access_token: 't', expires_in: 900, user });

    expect(renderHook(() => useCurrentUser()).result.current).toEqual(user);
  });

  it('refuses to invent a user when nobody is signed in', () => {
    expect(() => renderHook(() => useCurrentUser())).toThrow('needs a signed-in user');
  });
});
