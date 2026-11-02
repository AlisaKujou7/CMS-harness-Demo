const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60_000;
const LOCK_MS = 15 * 60_000;

export interface LoginLockoutState {
  readonly failureTimes: readonly Date[];
  readonly lockedUntil: Date | null;
}

// FR-AUTH-06: any 5 failures within 10 minutes lock the account for 15 minutes.
export class LoginLockout implements LoginLockoutState {
  private constructor(
    readonly failureTimes: readonly Date[],
    readonly lockedUntil: Date | null,
  ) {}

  static none(): LoginLockout {
    return new LoginLockout([], null);
  }

  static restore(state: LoginLockoutState): LoginLockout {
    return new LoginLockout(state.failureTimes, state.lockedUntil);
  }

  isLocked(now: Date): boolean {
    return this.lockedUntil !== null && now < this.lockedUntil;
  }

  recordFailure(now: Date): LoginLockout {
    const oldest = now.getTime() - WINDOW_MS;
    const earlier =
      this.lockedUntil === null ? this.failureTimes.filter((t) => t.getTime() >= oldest) : [];
    const failures = [...earlier, now];
    const lockedUntil = failures.length >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null;
    return new LoginLockout(failures, lockedUntil);
  }
}
