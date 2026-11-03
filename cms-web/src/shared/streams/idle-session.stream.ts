import {
  concat,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  type Observable,
  of,
  type SchedulerLike,
  asyncScheduler,
  startWith,
  switchMap,
  throttleTime,
  timer,
} from 'rxjs';

export type IdleState = 'active' | 'warning' | 'expired';

export interface IdleOptions {
  readonly warnAfterMs: number;
  readonly expireAfterMs: number;
  readonly scheduler?: SchedulerLike;
}

// SEC-12: every sign of activity starts the clock again.
export function makeIdleSession(
  activity$: Observable<unknown>,
  { warnAfterMs, expireAfterMs, scheduler = asyncScheduler }: IdleOptions,
): Observable<IdleState> {
  return activity$.pipe(
    startWith(null),
    switchMap(() =>
      concat(
        of<IdleState>('active'),
        timer(warnAfterMs, scheduler).pipe(map((): IdleState => 'warning')),
        timer(expireAfterMs - warnAfterMs, scheduler).pipe(map((): IdleState => 'expired')),
      ),
    ),
    distinctUntilChanged(),
  );
}

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const ACTIVITY_THROTTLE_MS = 1000;

export function userActivity$(target: Window = window): Observable<unknown> {
  return merge(...ACTIVITY_EVENTS.map((name) => fromEvent(target, name))).pipe(
    throttleTime(ACTIVITY_THROTTLE_MS),
  );
}
