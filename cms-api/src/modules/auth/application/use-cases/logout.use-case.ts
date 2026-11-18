import type { AuthDeps } from '../auth-deps.js';
import type { LogoutUseCase, SessionTokenCommand } from '../ports/in/auth.ports.js';

export class Logout implements LogoutUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(command: SessionTokenCommand): Promise<void> {
    const token = await this.deps.refreshTokens.findByHash(
      this.deps.opaqueTokens.hash(command.refreshToken),
    );
    if (!token) return;

    const revoked = await this.deps.refreshTokens.revokeIfActive(token.id, this.deps.clock.now());
    if (!revoked) return;

    await this.deps.audit.record({
      actorId: token.userId,
      actorIp: command.ip,
      action: 'auth.logout',
      targetType: 'user',
      targetId: token.userId,
      summary: {},
    });
  }
}
