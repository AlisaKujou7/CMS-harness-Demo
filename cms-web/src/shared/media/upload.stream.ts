import {
  catchError,
  concat,
  defer,
  from,
  map,
  mergeMap,
  type Observable,
  of,
  scan,
  switchMap,
} from 'rxjs';
import type { MediaRow, PresignedUpload } from '../api/types';

export interface UploadDeps {
  presign(file: File): Promise<PresignedUpload>;
  put(upload: PresignedUpload, file: File): Observable<number>;
  finalize(upload: PresignedUpload, file: File): Promise<MediaRow>;
}

export type UploadEvent =
  | { readonly kind: 'progress'; readonly name: string; readonly fraction: number }
  | { readonly kind: 'done'; readonly name: string; readonly item: MediaRow }
  | { readonly kind: 'failed'; readonly name: string; readonly error: unknown };

export interface UploadFailure {
  readonly name: string;
  readonly error: unknown;
}

export interface UploadSummary {
  readonly total: number;
  readonly finished: number;
  readonly percent: number;
  readonly items: readonly MediaRow[];
  readonly failures: readonly UploadFailure[];
  readonly fractions: Readonly<Record<string, number>>;
}

export function emptySummary(total: number): UploadSummary {
  return { total, finished: 0, percent: 0, items: [], failures: [], fractions: {} };
}

// 03-DESIGN 20.1: presign, send to storage, then tell the API about it.
export function uploadFile$(file: File, deps: UploadDeps): Observable<UploadEvent> {
  const { name } = file;
  return defer(() => deps.presign(file)).pipe(
    switchMap((upload) =>
      concat(
        deps
          .put(upload, file)
          .pipe(map((fraction): UploadEvent => ({ kind: 'progress', name, fraction }))),
        defer(() => deps.finalize(upload, file)).pipe(
          map((item): UploadEvent => ({ kind: 'done', name, item })),
        ),
      ),
    ),
    catchError((error: unknown) => of<UploadEvent>({ kind: 'failed', name, error })),
  );
}

function withEvent(summary: UploadSummary, event: UploadEvent): UploadSummary {
  if (event.kind === 'progress') {
    return { ...summary, fractions: { ...summary.fractions, [event.name]: event.fraction } };
  }
  const finished = { ...summary, finished: summary.finished + 1 };
  const fractions = { ...summary.fractions, [event.name]: 1 };
  return event.kind === 'done'
    ? { ...finished, fractions, items: [...summary.items, event.item] }
    : {
        ...finished,
        fractions,
        failures: [...summary.failures, { name: event.name, error: event.error }],
      };
}

export function summarize(summary: UploadSummary, event: UploadEvent): UploadSummary {
  const next = withEvent(summary, event);
  const sent = Object.values(next.fractions).reduce((sum, fraction) => sum + fraction, 0);
  return { ...next, percent: Math.round((sent / next.total) * 100) };
}

const CONCURRENT_UPLOADS = 3;

// 04-ARCH 5.5.1: one failed file does not stop the others.
export function uploadProgress$(
  files: readonly File[],
  deps: UploadDeps,
): Observable<UploadSummary> {
  return from(files).pipe(
    mergeMap((file) => uploadFile$(file, deps), CONCURRENT_UPLOADS),
    scan(summarize, emptySummary(files.length)),
  );
}
