const MAX_FAILURES = 5;
const WINDOW_MS = 10 * 60_000;
const LOCK_MS = 15 * 60_000;

export interface LoginLockoutState {
  readonly failureCount: number;
  readonly windowStartedAt: Date | null;
  readonly lockedUntil: Date | null;
}

// FR-AUTH-06: 5 failures within 10 minutes lock the account for 15 minutes.
export class LoginLockout implements LoginLockoutState {
  private constructor(
    readonly failureCount: number,
    readonly windowStartedAt: Date | null,
    readonly lockedUntil: Date | null,
  ) {}

  static none(): LoginLockout {
    return new LoginLockout(0, null, null);
  }

  static restore(state: LoginLockoutState): LoginLockout {
    return new LoginLockout(state.failureCount, state.windowStartedAt, state.lockedUntil);
  }

  isLocked(now: Date): boolean {
    return this.lockedUntil !== null && now < this.lockedUntil;
  }

  recordFailure(now: Date): LoginLockout {
    const count = this.isWindowOpen(now) ? this.failureCount + 1 : 1;
    const startedAt = this.isWindowOpen(now) ? this.windowStartedAt : now;
    const lockedUntil = count >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null;
    return new LoginLockout(count, startedAt, lockedUntil);
  }

  private isWindowOpen(now: Date): boolean {
    if (this.windowStartedAt === null || this.lockedUntil !== null) return false;
    return now.getTime() - this.windowStartedAt.getTime() <= WINDOW_MS;
  }
}
