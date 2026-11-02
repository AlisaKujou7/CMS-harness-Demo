import { InvalidResetTokenError } from '../../domain/errors/auth.errors.js';
import { assertPasswordPolicy } from '../../domain/value-objects/password.vo.js';
import type { AuthDeps } from '../auth-deps.js';
import type { CompletePasswordResetUseCase } from '../ports/in/auth.ports.js';

export class CompletePasswordReset implements CompletePasswordResetUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(command: {
    readonly token: string;
    readonly newPassword: string;
    readonly ip: string | null;
  }): Promise<void> {
    assertPasswordPolicy(command.newPassword);

    const now = this.deps.clock.now();
    const token = await this.deps.resetTokens.findByHash(
      this.deps.opaqueTokens.hash(command.token),
    );
    if (!token) throw new InvalidResetTokenError();

    const consumed = token.consume(now);
    const account = await this.deps.accounts.findById(token.userId);
    if (!account?.canLogin()) throw new InvalidResetTokenError();

    const passwordHash = await this.deps.hasher.hash(command.newPassword);
    await this.deps.tx.run(async () => {
      await this.deps.resetTokens.save(consumed);
      await this.deps.accounts.updatePassword(account.id, passwordHash);
      await this.deps.refreshTokens.revokeAllForUser(account.id, now);
      await this.deps.lockouts.clear(account.id);
      await this.deps.audit.record({
        actorId: account.id,
        actorIp: command.ip,
        action: 'auth.password.reset_completed',
        targetType: 'user',
        targetId: account.id,
        summary: {},
      });
    });
  }
}
