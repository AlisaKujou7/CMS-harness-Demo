import { from, NEVER, Subject } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { type AutosaveStatus, makeAutosave } from './autosave.stream';

function scheduler() {
  return new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });
}

const SAVING: AutosaveStatus = { kind: 'saving' };
const savedAt = (ms: number): AutosaveStatus => ({ kind: 'saved', at: new Date(ms) });

function collect(options: Parameters<typeof makeAutosave>[0]) {
  const seen: AutosaveStatus[] = [];
  const subscription = makeAutosave(options).subscribe((status) => seen.push(status));
  return { seen, subscription };
}

const flushPromises = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe('makeAutosave', () => {
  it('waits for 30 seconds of quiet by default (03-DESIGN 19.4)', () => {
    vi.useFakeTimers();
    const changes = new Subject<void>();
    const save = vi.fn().mockResolvedValue(true);
    const { subscription } = collect({
      changes$: changes,
      flush$: NEVER,
      save,
      isRetryable: () => false,
    });

    changes.next();
    vi.advanceTimersByTime(29_999);
    changes.next();
    vi.advanceTimersByTime(29_999);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledOnce();
    subscription.unsubscribe();
    vi.useRealTimers();
  });

  it('debounces bursts of changes, in virtual time', () => {
    const test = scheduler();
    test.run(({ hot, flush }) => {
      const save = vi.fn().mockReturnValue(new Promise(() => undefined));
      makeAutosave({
        changes$: hot('--a-b-------'),
        flush$: NEVER,
        save,
        isRetryable: () => false,
        debounceMs: 3,
        scheduler: test,
      }).subscribe();

      flush();

      expect(save).toHaveBeenCalledOnce();
    });
  });

  it('saves at once on a flush, reporting saving and then saved', async () => {
    const flush = new Subject<void>();
    const { seen, subscription } = collect({
      changes$: NEVER,
      flush$: flush,
      save: () => Promise.resolve(true),
      isRetryable: () => false,
    });

    flush.next();
    expect(seen).toEqual([SAVING]);

    await flushPromises();
    expect(seen).toHaveLength(2);
    expect(seen[1]?.kind).toBe('saved');
    subscription.unsubscribe();
  });

  it('stamps a save with the scheduler time', async () => {
    const test = scheduler();
    const { seen, subscription } = collect({
      changes$: NEVER,
      flush$: from([1]),
      save: () => Promise.resolve(true),
      isRetryable: () => false,
      scheduler: { ...test, now: () => 5000, schedule: test.schedule.bind(test) },
    });

    await flushPromises();

    expect(seen).toEqual([SAVING, savedAt(5000)]);
    subscription.unsubscribe();
  });

  it('reports when there was nothing to save', async () => {
    const flush = new Subject<void>();
    const { seen, subscription } = collect({
      changes$: NEVER,
      flush$: flush,
      save: () => Promise.resolve(false),
      isRetryable: () => false,
    });

    flush.next();
    await flushPromises();

    expect(seen).toEqual([SAVING, { kind: 'unchanged' }]);
    subscription.unsubscribe();
  });

  it('never runs two saves at once, so versions stay in order', async () => {
    const flush = new Subject<void>();
    const finish: (() => void)[] = [];
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish.push(() => {
            resolve(true);
          });
        }),
    );
    const { subscription } = collect({
      changes$: NEVER,
      flush$: flush,
      save,
      isRetryable: () => false,
    });

    flush.next();
    flush.next();
    expect(save).toHaveBeenCalledOnce();

    finish[0]?.();
    await flushPromises();
    expect(save).toHaveBeenCalledTimes(2);
    subscription.unsubscribe();
  });

  it('gives up at once on an error that retrying cannot fix', async () => {
    const flush = new Subject<void>();
    const save = vi.fn().mockRejectedValue('conflict');
    const { seen, subscription } = collect({
      changes$: NEVER,
      flush$: flush,
      save,
      isRetryable: () => false,
    });

    flush.next();
    await flushPromises();

    expect(seen).toEqual([SAVING, { kind: 'error', error: 'conflict' }]);
    expect(save).toHaveBeenCalledOnce();
    subscription.unsubscribe();
  });

  it('retries what might recover, then gives up, and then still works', async () => {
    vi.useFakeTimers();
    const flush = new Subject<void>();
    const save = vi.fn().mockRejectedValue('offline');
    const { seen, subscription } = collect({
      changes$: NEVER,
      flush$: flush,
      save,
      isRetryable: () => true,
      retryMs: 100,
      maxRetries: 2,
    });

    flush.next();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([SAVING, { kind: 'retrying', error: 'offline' }]);

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);
    expect(seen.at(-1)).toEqual({ kind: 'error', error: 'offline' });
    expect(save).toHaveBeenCalledTimes(3);

    save.mockResolvedValue(true);
    flush.next();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.at(-1)?.kind).toBe('saved');
    subscription.unsubscribe();
    vi.useRealTimers();
  });

  it('retries 3 times, 5 seconds apart, by default', async () => {
    vi.useFakeTimers();
    const flush = new Subject<void>();
    const save = vi.fn().mockRejectedValue('offline');
    const { subscription } = collect({
      changes$: NEVER,
      flush$: flush,
      save,
      isRetryable: () => true,
    });

    flush.next();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(4);
    subscription.unsubscribe();
    vi.useRealTimers();
  });
});
