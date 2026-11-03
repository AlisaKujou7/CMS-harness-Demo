import Snackbar from '@mui/material/Snackbar';
import { useIsMutating } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useObservableState } from '../hooks/useObservableState';
import { common } from '../i18n/common.messages';
import { connectivity$ } from '../streams/connectivity.stream';

// 03-DESIGN 14.3: stays until the connection is back.
export function OfflineNotice() {
  const online$ = useMemo(() => connectivity$(), []);
  const online = useObservableState(online$, true);
  return (
    <Snackbar
      open={!online}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      message={common.offline}
      slotProps={{ content: { role: 'alert' } }}
    />
  );
}

const STILL_WORKING_AFTER_MS = 2000;

// 03-DESIGN 14.2: an action that runs past 2 seconds says so.
export function StillWorkingNotice() {
  const working = useIsMutating() > 0;
  const slow = useDebouncedValue(working, STILL_WORKING_AFTER_MS);
  return (
    <Snackbar
      open={working && slow}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      message={common.stillWorking}
      slotProps={{ content: { role: 'status' } }}
    />
  );
}
