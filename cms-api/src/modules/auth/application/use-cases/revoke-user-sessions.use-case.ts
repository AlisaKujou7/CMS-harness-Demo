import type { AuthDeps } from '../auth-deps.js';
import type { RevokeUserSessionsUseCase } from '../ports/in/auth.ports.js';

export class RevokeUserSessions implements RevokeUserSessionsUseCase {
  constructor(private readonly deps: AuthDeps) {}

  execute(userId: string): Promise<void> {
    return this.deps.refreshTokens.revokeAllForUser(userId, this.deps.clock.now());
  }
}
