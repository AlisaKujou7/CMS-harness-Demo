import { useEffect, useState } from 'react';
import type { Observable } from 'rxjs';

// M-STATE-04: the one place components subscribe, so teardown cannot be forgotten.
export function useObservableState<T>(source$: Observable<T>, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const subscription = source$.subscribe(setValue);
    return () => {
      subscription.unsubscribe();
    };
  }, [source$]);
  return value;
}
