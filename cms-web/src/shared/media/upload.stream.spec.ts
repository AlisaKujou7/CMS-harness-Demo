import { lastValueFrom, of, throwError, toArray } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { aMedia } from '../../../test/builders';
import type { PresignedUpload } from '../api/types';
import {
  emptySummary,
  summarize,
  type UploadDeps,
  uploadFile$,
  uploadProgress$,
} from './upload.stream';

const upload = { storage_key: 'k' } as PresignedUpload;
const fileNamed = (name: string) => new File(['x'], name);
const item = aMedia();

function deps(overrides: Partial<UploadDeps> = {}): UploadDeps {
  return {
    presign: vi.fn().mockResolvedValue(upload),
    put: vi.fn(() => of(0.5, 1)),
    finalize: vi.fn().mockResolvedValue(item),
    ...overrides,
  };
}

describe('uploadFile$', () => {
  it('presigns, sends with progress, then finalizes', async () => {
    const file = fileNamed('a.png');
    const steps = deps();

    const events = await lastValueFrom(uploadFile$(file, steps).pipe(toArray()));

    expect(events).toEqual([
      { kind: 'progress', name: 'a.png', fraction: 0.5 },
      { kind: 'progress', name: 'a.png', fraction: 1 },
      { kind: 'done', name: 'a.png', item },
    ]);
    expect(steps.put).toHaveBeenCalledWith(upload, file);
    expect(steps.finalize).toHaveBeenCalledWith(upload, file);
  });

  it.each([
    ['presign', { presign: vi.fn().mockRejectedValue('no') }],
    ['put', { put: () => throwError(() => 'no') }],
    ['finalize', { finalize: vi.fn().mockRejectedValue('no') }],
  ])('reports a failure at %s as an event, not an error', async (_step, overrides) => {
    const events = await lastValueFrom(
      uploadFile$(fileNamed('a.png'), deps(overrides)).pipe(toArray()),
    );

    expect(events.at(-1)).toEqual({ kind: 'failed', name: 'a.png', error: 'no' });
  });

  it('does not finalize a failed send', async () => {
    const steps = deps({ put: () => throwError(() => 'no') });

    await lastValueFrom(uploadFile$(fileNamed('a.png'), steps).pipe(toArray()));

    expect(steps.finalize).not.toHaveBeenCalled();
  });
});

describe('summarize', () => {
  it('averages progress across all the files', () => {
    const summary = summarize(emptySummary(2), { kind: 'progress', name: 'a', fraction: 0.5 });

    expect(summary).toMatchObject({ percent: 25, finished: 0, fractions: { a: 0.5 } });
  });

  it('counts a finished file as fully sent', () => {
    const summary = summarize(emptySummary(2), { kind: 'done', name: 'a', item });

    expect(summary).toMatchObject({ percent: 50, finished: 1, items: [item], failures: [] });
  });

  it('records a failure and does not mutate what it was given', () => {
    const before = emptySummary(1);

    const after = summarize(before, { kind: 'failed', name: 'a', error: 'no' });

    expect(after).toMatchObject({
      percent: 100,
      finished: 1,
      items: [],
      failures: [{ name: 'a', error: 'no' }],
    });
    expect(before).toEqual(emptySummary(1));
  });
});

describe('uploadProgress$', () => {
  it('finishes every file even when one fails', async () => {
    const steps = deps({
      presign: vi.fn((file: File) =>
        file.name === 'bad' ? Promise.reject(new Error('no')) : Promise.resolve(upload),
      ),
    });

    const last = await lastValueFrom(uploadProgress$([fileNamed('bad'), fileNamed('ok')], steps));

    expect(last).toMatchObject({ total: 2, finished: 2, percent: 100, items: [item] });
    expect(last.failures.map((failure) => failure.name)).toEqual(['bad']);
  });

  it('sends at most 3 at a time', () => {
    const scheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
    scheduler.run(({ cold, flush }) => {
      const started: string[] = [];
      const steps = deps({
        presign: vi.fn(() => Promise.resolve(upload)),
        put: () => cold('--|'),
      });
      const files = ['1', '2', '3', '4'].map(fileNamed);
      const counting: UploadDeps = {
        ...steps,
        presign: (file) => {
          started.push(file.name);
          return steps.presign(file);
        },
      };

      uploadProgress$(files, counting).subscribe();
      flush();

      expect(started).toEqual(['1', '2', '3']);
    });
  });
});
