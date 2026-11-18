import { InvitationToken } from '../../domain/entities/invitation-token.entity.js';
import type { AuthDeps } from '../auth-deps.js';
import type { SendInvitationUseCase } from '../ports/in/auth.ports.js';

export class SendInvitation implements SendInvitationUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(command: { readonly userId: string; readonly email: string }): Promise<void> {
    const now = this.deps.clock.now();
    const rawToken = this.deps.opaqueTokens.generate();
    await this.deps.invitationTokens.invalidateForUser(command.userId, now);
    await this.deps.invitationTokens.save(
      InvitationToken.issue({
        id: this.deps.ids.next(),
        userId: command.userId,
        tokenHash: this.deps.opaqueTokens.hash(rawToken),
        now,
      }),
    );

    const link = `${this.deps.config.publicUrl}/accept-invitation?token=${encodeURIComponent(rawToken)}`;
    try {
      await this.deps.email.send({
        to: command.email,
        subject: 'You have been invited to the CMS',
        text: `Use this link to set your password. It expires in 7 days and works once.\n\n${link}`,
      });
    } catch {
      this.deps.logger.error('Invitation email failed', { userId: command.userId });
    }
  }
}
