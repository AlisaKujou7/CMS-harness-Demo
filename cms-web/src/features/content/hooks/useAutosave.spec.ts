import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { networkError } from '../../../shared/api/api-error';
import { useAutosave } from './useAutosave';

function setup(save: () => Promise<boolean>) {
  const onError = vi.fn();
  return { ...renderHook(() => useAutosave({ save, onError })), onError };
}

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers a flush with how the save ended, and shows it', async () => {
    const { result } = setup(() => Promise.resolve(true));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.flush();
    });

    expect(outcome).toMatchObject({ kind: 'saved' });
    expect(result.current.indicator).toMatchObject({ kind: 'saved' });
  });

  it('keeps showing the last real save when there was nothing to save', async () => {
    const save = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
    const { result } = setup(save);

    await act(async () => {
      await result.current.flush();
    });
    await act(async () => {
      await result.current.flush();
    });

    expect(result.current.indicator).toMatchObject({ kind: 'saved' });
  });

  it('reports a failure to its handler', async () => {
    const failure = new Error('refused');
    const { result, onError } = setup(() => Promise.reject(failure));

    await act(async () => {
      await result.current.flush();
    });

    expect(onError).toHaveBeenCalledWith(failure);
    expect(result.current.indicator).toMatchObject({ kind: 'error' });
  });

  it('saves after 30 seconds of quiet', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { result } = setup(save);

    act(() => {
      result.current.notifyChange();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(save).toHaveBeenCalledOnce();
  });

  describe('after the screen has gone', () => {
    it('drops a pending autosave', async () => {
      const save = vi.fn().mockResolvedValue(true);
      const { result, unmount } = setup(save);

      act(() => {
        result.current.notifyChange();
      });
      unmount();
      await vi.advanceTimersByTimeAsync(30_000);

      expect(save).not.toHaveBeenCalled();
    });

    it('stops retrying, and tells anyone waiting that it did not save', async () => {
      const save = vi.fn().mockRejectedValue(networkError('offline'));
      const { result, unmount, onError } = setup(save);

      let outcome: Promise<unknown> = Promise.resolve();
      act(() => {
        outcome = result.current.flush();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(save).toHaveBeenCalledOnce();

      unmount();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(save).toHaveBeenCalledOnce();
      await expect(outcome).resolves.toMatchObject({ kind: 'error' });
      expect(onError).not.toHaveBeenCalled();
    });

    it('refuses a late flush, such as from a field blurring as it is removed', async () => {
      const save = vi.fn().mockResolvedValue(true);
      const { result, unmount } = setup(save);
      const { flush } = result.current;

      unmount();

      await expect(flush()).resolves.toMatchObject({ kind: 'error' });
      expect(save).not.toHaveBeenCalled();
    });
  });
});
