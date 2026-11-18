import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { filter, firstValueFrom, Subject } from 'rxjs';
import { isRetryable } from '../../../shared/api/api-error';
import type { IndicatorState } from '../components/AutosaveIndicator';
import { type AutosaveStatus, makeAutosave } from '../streams/autosave.stream';

export type SaveOutcome = Extract<AutosaveStatus, { kind: 'saved' | 'unchanged' | 'error' }>;

// What anyone waiting on a save hears when the screen goes away, so nothing acts on it afterwards.
const ABANDONED: SaveOutcome = { kind: 'error', error: null };

function isOutcome(status: AutosaveStatus): status is SaveOutcome {
  return status.kind === 'saved' || status.kind === 'unchanged' || status.kind === 'error';
}

export interface AutosaveHandlers {
  save(): Promise<boolean>;
  onError(error: unknown): void;
}

// 04-ARCH 5.9: bridges the form to autosave$ and the indicator. The pipeline lives exactly as long
// as the screen, so a pending retry or debounce cannot save for an editor that has gone.
export function useAutosave(handlers: AutosaveHandlers) {
  const latest = useRef(handlers);
  latest.current = handlers;
  const changes = useMemo(() => new Subject<void>(), []);
  const flushes = useMemo(() => new Subject<void>(), []);
  const statuses = useMemo(() => new Subject<AutosaveStatus>(), []);
  const [indicator, setIndicator] = useState<IndicatorState>({ kind: 'idle' });
  // "Unchanged" keeps saying when the last real save happened.
  const lastSaved = useRef<IndicatorState>({ kind: 'idle' });
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const subscription = makeAutosave({
      changes$: changes,
      flush$: flushes,
      save: () => latest.current.save(),
      isRetryable,
    }).subscribe((status) => {
      if (status.kind === 'saved') lastSaved.current = status;
      if (status.kind === 'error') latest.current.onError(status.error);
      setIndicator(status.kind === 'unchanged' ? lastSaved.current : status);
      statuses.next(status);
    });
    return () => {
      mounted.current = false;
      subscription.unsubscribe();
      statuses.next(ABANDONED);
    };
  }, [changes, flushes, statuses]);

  const notifyChange = useCallback(() => {
    changes.next();
  }, [changes]);

  // Saves now, and answers with how it ended, which is what an action like Publish must wait for.
  const flush = useCallback((): Promise<SaveOutcome> => {
    if (!mounted.current) return Promise.resolve(ABANDONED);
    const outcome = firstValueFrom(statuses.pipe(filter(isOutcome)));
    flushes.next();
    return outcome;
  }, [statuses, flushes]);

  return { indicator, notifyChange, flush };
}
