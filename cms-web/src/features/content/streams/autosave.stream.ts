import {
  asyncScheduler,
  catchError,
  concat,
  concatMap,
  debounceTime,
  defer,
  map,
  merge,
  mergeMap,
  type Observable,
  of,
  type SchedulerLike,
  startWith,
  timer,
} from 'rxjs';

export type AutosaveStatus =
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly at: Date }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'retrying'; readonly error: unknown }
  | { readonly kind: 'error'; readonly error: unknown };

export interface AutosaveOptions {
  readonly changes$: Observable<unknown>;
  readonly flush$: Observable<unknown>;
  // Saves what is current when called, and answers whether there was anything to save.
  save(): Promise<boolean>;
  isRetryable(error: unknown): boolean;
  readonly debounceMs?: number;
  readonly retryMs?: number;
  readonly maxRetries?: number;
  readonly scheduler?: SchedulerLike;
}

const IDLE_MS = 30_000;
const RETRY_MS = 5_000;
const MAX_RETRIES = 3;

// 03-DESIGN 19.4. 04-ARCH 5.4.2 sketches switchMap, but a save cancelled here still lands on the
// server and moves the version on, so the next save would look like someone else's edit. Saves run
// one at a time instead, and each sends what is current when its turn comes (ADR-0013).
export function makeAutosave(options: AutosaveOptions): Observable<AutosaveStatus> {
  const { changes$, flush$, save, isRetryable } = options;
  const { debounceMs = IDLE_MS, retryMs = RETRY_MS, maxRetries = MAX_RETRIES } = options;
  const { scheduler = asyncScheduler } = options;

  const attempt = (failures: number): Observable<AutosaveStatus> =>
    defer(save).pipe(
      map((saved): AutosaveStatus =>
        saved ? { kind: 'saved', at: new Date(scheduler.now()) } : { kind: 'unchanged' },
      ),
      catchError((error: unknown) =>
        isRetryable(error) && failures < maxRetries
          ? concat(
              of<AutosaveStatus>({ kind: 'retrying', error }),
              timer(retryMs, scheduler).pipe(mergeMap(() => attempt(failures + 1))),
            )
          : of<AutosaveStatus>({ kind: 'error', error }),
      ),
    );

  return merge(changes$.pipe(debounceTime(debounceMs, scheduler)), flush$).pipe(
    concatMap(() => attempt(0).pipe(startWith<AutosaveStatus>({ kind: 'saving' }))),
  );
}
