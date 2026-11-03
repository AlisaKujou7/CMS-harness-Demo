import { create } from 'zustand';
import type { AuthSession } from '../api/types';

export type SessionUser = AuthSession['user'];
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

interface SessionState {
  readonly status: SessionStatus;
  // Held in memory only (04-ARCH 6.3). A reload gets a new one from the refresh cookie.
  readonly accessToken: string | null;
  readonly user: SessionUser | null;
  start(session: AuthSession): void;
  end(): void;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  accessToken: null,
  user: null,
  start: (session) => {
    set({ status: 'authenticated', accessToken: session.access_token, user: session.user });
  },
  end: () => {
    set({ status: 'anonymous', accessToken: null, user: null });
  },
}));

export function useCurrentUser(): SessionUser {
  const user = useSessionStore((state) => state.user);
  if (user === null) throw new Error('useCurrentUser needs a signed-in user');
  return user;
}
