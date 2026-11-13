import { act, renderHook } from '@testing-library/react';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { useObservableState } from './useObservableState';

describe('useObservableState', () => {
  it('follows the stream and unsubscribes on unmount', () => {
    const source = new Subject<number>();
    const { result, unmount } = renderHook(() => useObservableState(source, 0));

    expect(result.current).toBe(0);
    act(() => {
      source.next(1);
    });
    expect(result.current).toBe(1);

    unmount();
    expect(source.observed).toBe(false);
  });
});
