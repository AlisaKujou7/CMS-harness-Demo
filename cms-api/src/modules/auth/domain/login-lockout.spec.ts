import { describe, expect, it } from 'vitest';
import { LoginLockout } from './services/login-lockout.js';

const T0 = new Date('2026-05-11T10:00:00Z');
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

const failTimes = (count: number, at: Date = T0) => {
  let lockout = LoginLockout.none();
  for (let i = 0; i < count; i += 1) lockout = lockout.recordFailure(at);
  return lockout;
};

describe('LoginLockout', () => {
  it('starts unlocked with no failures', () => {
    const lockout = LoginLockout.none();

    expect(lockout.isLocked(T0)).toBe(false);
    expect(lockout.failureCount).toBe(0);
  });

  it('stays unlocked after 4 failures', () => {
    expect(failTimes(4).isLocked(T0)).toBe(false);
  });

  it('locks on the 5th failure within the window', () => {
    expect(failTimes(5).isLocked(T0)).toBe(true);
  });

  it('counts a failure at exactly 10 minutes as inside the window', () => {
    const lockout = failTimes(4).recordFailure(minutes(10));

    expect(lockout.isLocked(minutes(10))).toBe(true);
  });

  it('restarts the count when a failure falls after the 10 minute window', () => {
    const lockout = failTimes(4).recordFailure(minutes(11));

    expect(lockout.failureCount).toBe(1);
    expect(lockout.isLocked(minutes(11))).toBe(false);
    expect(lockout.windowStartedAt).toEqual(minutes(11));
  });

  it('keeps the original window start for failures inside the window', () => {
    expect(failTimes(2).recordFailure(minutes(3)).windowStartedAt).toEqual(T0);
  });

  it('is still locked one millisecond before 15 minutes pass', () => {
    const lockout = failTimes(5);

    expect(lockout.isLocked(new Date(minutes(15).getTime() - 1))).toBe(true);
  });

  it('unlocks at exactly 15 minutes', () => {
    expect(failTimes(5).isLocked(minutes(15))).toBe(false);
  });

  it('counts afresh after a lock has expired', () => {
    const lockout = failTimes(5).recordFailure(minutes(16));

    expect(lockout.failureCount).toBe(1);
    expect(lockout.lockedUntil).toBeNull();
  });

  it('does not mutate the previous state', () => {
    const before = failTimes(1);

    before.recordFailure(T0);

    expect(before.failureCount).toBe(1);
  });

  it('round-trips through its persisted state', () => {
    const lockout = failTimes(5);

    const restored = LoginLockout.restore({
      failureCount: lockout.failureCount,
      windowStartedAt: lockout.windowStartedAt,
      lockedUntil: lockout.lockedUntil,
    });

    expect(restored.isLocked(T0)).toBe(true);
    expect(restored.failureCount).toBe(5);
    expect(restored.lockedUntil).toEqual(minutes(15));
  });
});
