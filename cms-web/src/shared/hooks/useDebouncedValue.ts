import { useEffect, useMemo, useState } from 'react';
import { debounceTime, Subject } from 'rxjs';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const changes = useMemo(() => new Subject<T>(), []);

  useEffect(() => {
    const subscription = changes.pipe(debounceTime(delayMs)).subscribe(setDebounced);
    return () => {
      subscription.unsubscribe();
    };
  }, [changes, delayMs]);

  useEffect(() => {
    changes.next(value);
  }, [changes, value]);

  return debounced;
}
