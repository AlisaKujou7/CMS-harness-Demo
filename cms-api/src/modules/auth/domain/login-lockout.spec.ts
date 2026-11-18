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
    expect(lockout.failureTimes).toEqual([]);
    expect(lockout.lockedUntil).toBeNull();
  });

  it('stays unlocked after 4 failures', () => {
    expect(failTimes(4).isLocked(T0)).toBe(false);
  });

  it('locks on the 5th failure within the window', () => {
    expect(failTimes(5).isLocked(T0)).toBe(true);
  });

  it('counts a failure exactly 10 minutes old as inside the window', () => {
    const lockout = failTimes(4).recordFailure(minutes(10));

    expect(lockout.isLocked(minutes(10))).toBe(true);
  });

  it('forgets a failure older than 10 minutes', () => {
    const lockout = failTimes(4).recordFailure(new Date(minutes(10).getTime() + 1));

    expect(lockout.failureTimes).toHaveLength(1);
    expect(lockout.isLocked(minutes(11))).toBe(false);
  });

  it('locks on any 5 failures inside 10 minutes, wherever the first one was (FR-AUTH-06)', () => {
    let lockout = LoginLockout.none().recordFailure(T0);
    for (let i = 0; i < 3; i += 1) lockout = lockout.recordFailure(minutes(9));

    lockout = lockout.recordFailure(minutes(11));
    expect(lockout.isLocked(minutes(11))).toBe(false);

    lockout = lockout.recordFailure(minutes(11));

    expect(lockout.isLocked(minutes(11))).toBe(true);
  });

  it('is still locked one millisecond before 15 minutes pass', () => {
    const lockout = failTimes(5);

    expect(lockout.isLocked(new Date(minutes(15).getTime() - 1))).toBe(true);
  });

  it('unlocks at exactly 15 minutes', () => {
    expect(failTimes(5).isLocked(minutes(15))).toBe(false);
  });

  it('counts afresh after a lock has expired', () => {
    const lockout = failTimes(5).recordFailure(minutes(15));

    expect(lockout.failureTimes).toEqual([minutes(15)]);
    expect(lockout.lockedUntil).toBeNull();
  });

  it('does not mutate the previous state', () => {
    const before = failTimes(1);

    before.recordFailure(T0);

    expect(before.failureTimes).toHaveLength(1);
  });

  it('round-trips through its persisted state', () => {
    const lockout = failTimes(5);

    const restored = LoginLockout.restore({
      failureTimes: lockout.failureTimes,
      lockedUntil: lockout.lockedUntil,
    });

    expect(restored.isLocked(T0)).toBe(true);
    expect(restored.failureTimes).toHaveLength(5);
    expect(restored.lockedUntil).toEqual(minutes(15));
  });
});
