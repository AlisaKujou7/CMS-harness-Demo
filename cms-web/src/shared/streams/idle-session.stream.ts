import {
  concat,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  Observable,
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

const ACTIVITY_CHANNEL = 'cms-session-activity';

// Tabs share one session, and signing out revokes it for all of them. So activity in any tab counts
// in every tab, or a forgotten tab would sign out someone working in another.
export function sharedActivity$(
  local$: Observable<unknown> = userActivity$(),
  openChannel: () => BroadcastChannel = () => new BroadcastChannel(ACTIVITY_CHANNEL),
): Observable<unknown> {
  return new Observable((subscriber) => {
    const channel = openChannel();
    channel.onmessage = () => {
      subscriber.next(null);
    };
    const subscription = local$.subscribe((activity) => {
      channel.postMessage(null);
      subscriber.next(activity);
    });
    return () => {
      subscription.unsubscribe();
      channel.close();
    };
  });
}
