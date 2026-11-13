import { renderHook } from '@testing-library/react';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { useSubscription } from './useSubscription';

describe('useSubscription', () => {
  it('delivers values until unmounted', () => {
    const source = new Subject<number>();
    const onValue = vi.fn();
    const { unmount } = renderHook(() => {
      useSubscription(source, onValue);
    });

    source.next(1);
    expect(onValue).toHaveBeenCalledWith(1);

    unmount();
    expect(source.observed).toBe(false);
  });
});
