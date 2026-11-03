import { Subject } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { describe, expect, it } from 'vitest';
import { makeIdleSession, userActivity$ } from './idle-session.stream';

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected);
  });

const STATES = { a: 'active', w: 'warning', e: 'expired' } as const;

describe('makeIdleSession (SEC-12)', () => {
  it('warns and then expires with no activity', () => {
    const test = scheduler();
    test.run(({ cold, expectObservable }) => {
      const result = makeIdleSession(cold('-'), {
        warnAfterMs: 10,
        expireAfterMs: 15,
        scheduler: test,
      });

      expectObservable(result).toBe('a 9ms w 4ms e', STATES);
    });
  });

  it('starts the clock again on activity', () => {
    const test = scheduler();
    test.run(({ cold, expectObservable }) => {
      const activity = cold('---- 4ms x');
      const result = makeIdleSession(activity, {
        warnAfterMs: 10,
        expireAfterMs: 15,
        scheduler: test,
      });

      expectObservable(result).toBe('a 17ms w 4ms e', STATES);
    });
  });

  it('goes back to active when a warned user moves', () => {
    const test = scheduler();
    test.run(({ cold, expectObservable }) => {
      const activity = cold('12ms x');
      const result = makeIdleSession(activity, {
        warnAfterMs: 10,
        expireAfterMs: 20,
        scheduler: test,
      });

      expectObservable(result).toBe('a 9ms w 1ms a 9ms w 9ms e', STATES);
    });
  });

  it('uses real time by default', () => {
    const activity = new Subject<void>();
    const seen: string[] = [];
    const subscription = makeIdleSession(activity, {
      warnAfterMs: 1000,
      expireAfterMs: 2000,
    }).subscribe((state) => seen.push(state));
    subscription.unsubscribe();

    expect(seen).toEqual(['active']);
  });
});

describe('userActivity$', () => {
  it('counts a burst of events once', () => {
    let count = 0;
    const subscription = userActivity$().subscribe(() => {
      count += 1;
    });

    window.dispatchEvent(new Event('keydown'));
    window.dispatchEvent(new Event('mousemove'));
    subscription.unsubscribe();

    expect(count).toBe(1);
  });
});
