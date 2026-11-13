import { distinctUntilChanged, fromEvent, map, merge, type Observable, startWith } from 'rxjs';

// 04-ARCH 5.5.1. Emits true while online.
export function connectivity$(target: Window = window): Observable<boolean> {
  return merge(
    fromEvent(target, 'online').pipe(map(() => true)),
    fromEvent(target, 'offline').pipe(map(() => false)),
  ).pipe(startWith(target.navigator.onLine), distinctUntilChanged());
}
