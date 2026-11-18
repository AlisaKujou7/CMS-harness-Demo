import type { AuthDeps } from '../auth-deps.js';
import type { PurgeExpiredTokensUseCase } from '../ports/in/auth.ports.js';

// An expired token can never be accepted, so nothing is lost and the tables stop growing. Refresh
// tokens matter until they expire, because replaying a rotated one revokes its family.
export class PurgeExpiredTokens implements PurgeExpiredTokensUseCase {
  constructor(
    private readonly deps: Pick<
      AuthDeps,
      'refreshTokens' | 'resetTokens' | 'invitationTokens' | 'clock'
    >,
  ) {}

  async execute(): Promise<number> {
    const now = this.deps.clock.now();
    const counts = await Promise.all([
      this.deps.refreshTokens.deleteExpiredBefore(now),
      this.deps.resetTokens.deleteExpiredBefore(now),
      this.deps.invitationTokens.deleteExpiredBefore(now),
    ]);
    return counts.reduce((total, count) => total + count, 0);
  }
}
