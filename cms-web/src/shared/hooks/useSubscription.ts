import { useEffect } from 'react';
import type { Observable } from 'rxjs';

// M-STATE-04: runs a side effect for each value, and always tears down.
export function useSubscription<T>(source$: Observable<T>, onValue: (value: T) => void): void {
  useEffect(() => {
    const subscription = source$.subscribe(onValue);
    return () => {
      subscription.unsubscribe();
    };
  }, [source$, onValue]);
}
