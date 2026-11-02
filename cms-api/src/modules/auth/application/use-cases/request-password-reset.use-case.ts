import { Email } from '../../../../shared/kernel/email.js';
import type { Account } from '../../domain/entities/account.entity.js';
import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity.js';
import type { AuthDeps } from '../auth-deps.js';
import type { RequestPasswordResetUseCase } from '../ports/in/auth.ports.js';

export class RequestPasswordReset implements RequestPasswordResetUseCase {
  constructor(private readonly deps: AuthDeps) {}

  // Resolves the same way whether or not the account exists, so it cannot reveal which emails do.
  async execute(command: { readonly email: string; readonly ip: string | null }): Promise<void> {
    const email = Email.parse(command.email);
    const account = email ? await this.deps.accounts.findByEmail(email.value) : null;
    if (!account?.canLogin()) return;

    const now = this.deps.clock.now();
    const rawToken = this.deps.opaqueTokens.generate();
    await this.deps.resetTokens.invalidateForUser(account.id, now);
    await this.deps.resetTokens.save(
      PasswordResetToken.issue({
        id: this.deps.ids.next(),
        userId: account.id,
        tokenHash: this.deps.opaqueTokens.hash(rawToken),
        now,
      }),
    );
    await this.deps.audit.record({
      actorId: account.id,
      actorIp: command.ip,
      action: 'auth.password.reset_requested',
      targetType: 'user',
      targetId: account.id,
      summary: {},
    });
    await this.sendEmail(account, rawToken);
  }

  private async sendEmail(account: Account, rawToken: string): Promise<void> {
    const link = `${this.deps.config.publicUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await this.deps.email.send({
        to: account.email,
        subject: 'Reset your CMS password',
        text: `Use this link to reset your password. It expires in 60 minutes and works once.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
      });
    } catch {
      this.deps.logger.error('Password reset email failed', { userId: account.id });
    }
  }
}
