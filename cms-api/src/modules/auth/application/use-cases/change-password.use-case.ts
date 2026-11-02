import type { Actor } from '../../../../shared/kernel/actor.js';
import { AppError } from '../../../../shared/kernel/app-error.js';
import { assertPasswordPolicy } from '../../domain/value-objects/password.vo.js';
import type { AuthDeps } from '../auth-deps.js';
import type { ChangePasswordUseCase } from '../ports/in/auth.ports.js';

export class IncorrectCurrentPasswordError extends AppError {
  constructor() {
    super({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      message: 'Current password is incorrect',
      details: { field: 'currentPassword' },
    });
  }
}

export class ChangePassword implements ChangePasswordUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(command: {
    readonly actor: Actor;
    readonly currentPassword: string;
    readonly newPassword: string;
    readonly ip: string | null;
  }): Promise<void> {
    const userId = command.actor.id;
    await this.assertCurrentPassword(userId, command.currentPassword);
    assertPasswordPolicy(command.newPassword);

    const passwordHash = await this.deps.hasher.hash(command.newPassword);
    await this.deps.tx.run(async () => {
      await this.deps.accounts.updatePassword(userId, passwordHash);
      await this.deps.refreshTokens.revokeAllForUser(userId, this.deps.clock.now());
      await this.deps.audit.record({
        actorId: userId,
        actorIp: command.ip,
        action: 'auth.password.changed',
        targetType: 'user',
        targetId: userId,
        summary: {},
      });
    });
  }

  private async assertCurrentPassword(userId: string, password: string): Promise<void> {
    const account = await this.deps.accounts.findById(userId);
    const matches =
      account?.passwordHash != null &&
      (await this.deps.hasher.verify(account.passwordHash, password));
    if (!matches) throw new IncorrectCurrentPasswordError();
  }
}
