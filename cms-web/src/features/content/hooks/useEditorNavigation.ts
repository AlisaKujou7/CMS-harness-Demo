import { useCallback, useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';

// 02-SRS 4.1: an unsaved-changes prompt on navigation, unless the screen itself is moving on.
export function useEditorNavigation(hasUnsaved: () => boolean) {
  const leaving = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !leaving.current && currentLocation.pathname !== nextLocation.pathname && hasUnsaved(),
  );
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (hasUnsaved()) event.preventDefault();
      },
      [hasUnsaved],
    ),
  );
  const allowNextNavigation = useCallback(() => {
    leaving.current = true;
  }, []);
  const navigationDone = useCallback(() => {
    leaving.current = false;
  }, []);
  return { blocker, allowNextNavigation, navigationDone };
}
