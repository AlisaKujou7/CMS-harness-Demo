import { useEffect, useMemo } from 'react';
import { ConfirmDialog } from '../../../design-system/components/ConfirmDialog';
import { useObservableState } from '../../../shared/hooks/useObservableState';
import { makeIdleSession, userActivity$ } from '../../../shared/streams/idle-session.stream';
import { notify } from '../../../shared/stores/ui.store';
import { authMessages as m } from '../auth.messages';
import { useLogout } from '../hooks/useLogout';

const MINUTE_MS = 60_000;
export const IDLE_WARN_MS = 28 * MINUTE_MS;
export const IDLE_EXPIRE_MS = 30 * MINUTE_MS;

// SEC-12. Any movement dismisses the warning, because it counts as activity.
export function IdleSessionContainer() {
  const logout = useLogout();
  const idle$ = useMemo(
    () =>
      makeIdleSession(userActivity$(), {
        warnAfterMs: IDLE_WARN_MS,
        expireAfterMs: IDLE_EXPIRE_MS,
      }),
    [],
  );
  const state = useObservableState(idle$, 'active');

  useEffect(() => {
    if (state !== 'expired') return;
    notify.info(m.idleExpired);
    void logout();
  }, [state, logout]);

  return (
    <ConfirmDialog
      open={state === 'warning'}
      title={m.idleTitle}
      body={m.idleBody}
      confirmLabel={m.idleStay}
      cancelLabel={m.idleSignOut}
      onConfirm={() => undefined}
      onCancel={() => {
        void logout();
      }}
    />
  );
}
