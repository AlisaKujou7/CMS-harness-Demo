import { describe, expect, it } from 'vitest';
import { connectivity$ } from './connectivity.stream';

describe('connectivity$', () => {
  it('starts from the current state and follows changes, without repeats', () => {
    const seen: boolean[] = [];
    const subscription = connectivity$().subscribe((online) => seen.push(online));

    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    subscription.unsubscribe();
    window.dispatchEvent(new Event('offline'));

    expect(seen).toEqual([true, false, true]);
  });
});
