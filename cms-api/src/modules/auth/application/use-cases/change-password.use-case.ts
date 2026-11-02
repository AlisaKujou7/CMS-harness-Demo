import type { Actor } from '../../../../shared/kernel/actor.js';
import { AppError } from '../../../../shared/kernel/app-error.js';
import { assertPasswordPolicy } from '../../domain/value-objects/password.vo.js';
import type { AuthDeps } from '../auth-deps.js';
import type { ChangePasswordUseCase } from '../ports/in/auth.ports.js';
import { admitPasswordAttempt } from '../services/password-attempts.js';

interface ChangePasswordCommand {
  readonly actor: Actor;
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly ip: string | null;
}

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

  async execute(command: ChangePasswordCommand): Promise<void> {
    assertPasswordPolicy(command.newPassword);
    await this.assertCurrentPassword(command);

    const userId = command.actor.id;
    const passwordHash = await this.deps.hasher.hash(command.newPassword);
    await this.deps.tx.run(async () => {
      await this.deps.accounts.updatePassword(userId, passwordHash);
      await this.deps.refreshTokens.revokeAllForUser(userId, this.deps.clock.now());
      await this.deps.lockouts.clear(userId);
      await this.audit(command, 'auth.password.changed', {});
    });
  }

  // A stolen access token must not allow unlimited guesses, so this shares the login lockout.
  private async assertCurrentPassword(command: ChangePasswordCommand): Promise<void> {
    const userId = command.actor.id;
    const account = await this.deps.accounts.findById(userId);
    if (account?.passwordHash == null) throw new IncorrectCurrentPasswordError();

    if (!(await admitPasswordAttempt(this.deps, userId))) {
      await this.deps.hasher.verifyAgainstNothing(command.currentPassword);
      await this.audit(command, 'auth.password.change_failed', { reason: 'locked' });
      throw new IncorrectCurrentPasswordError();
    }
    if (!(await this.deps.hasher.verify(account.passwordHash, command.currentPassword))) {
      await this.audit(command, 'auth.password.change_failed', { reason: 'bad_credentials' });
      throw new IncorrectCurrentPasswordError();
    }
  }

  private audit(
    command: ChangePasswordCommand,
    action: string,
    summary: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    return this.deps.audit.record({
      actorId: command.actor.id,
      actorIp: command.ip,
      action,
      targetType: 'user',
      targetId: command.actor.id,
      summary,
    });
  }
}
