import type { AuthDeps } from '../auth-deps.js';

// Charges the attempt before the password is checked, under a row lock, so parallel guesses cannot
// all read an unlocked state. A correct password clears the charge afterwards.
export function admitPasswordAttempt(
  deps: Pick<AuthDeps, 'tx' | 'lockouts' | 'clock'>,
  userId: string,
): Promise<boolean> {
  return deps.tx.run(async () => {
    const now = deps.clock.now();
    const lockout = await deps.lockouts.findForUpdate(userId);
    if (lockout.isLocked(now)) return false;
    await deps.lockouts.save(userId, lockout.recordFailure(now));
    return true;
  });
}
