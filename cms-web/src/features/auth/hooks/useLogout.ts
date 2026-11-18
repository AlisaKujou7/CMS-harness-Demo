import { useCallback } from 'react';
import { useSessionStore } from '../../../shared/stores/session.store';
import { logout } from '../api/auth.api';

// The session ends on this device even if the server cannot be told, since the access token goes.
export function useLogout(): () => Promise<void> {
  return useCallback(async () => {
    await logout().catch(() => undefined);
    useSessionStore.getState().end();
  }, []);
}
