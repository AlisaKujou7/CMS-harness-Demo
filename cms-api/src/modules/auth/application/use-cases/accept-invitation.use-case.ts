import { InvalidInvitationError } from '../../domain/errors/auth.errors.js';
import { assertPasswordPolicy } from '../../domain/value-objects/password.vo.js';
import type { AuthDeps } from '../auth-deps.js';
import type { AcceptInvitationUseCase } from '../ports/in/auth.ports.js';

export class AcceptInvitation implements AcceptInvitationUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(command: {
    readonly token: string;
    readonly newPassword: string;
    readonly ip: string | null;
  }): Promise<void> {
    assertPasswordPolicy(command.newPassword);

    const now = this.deps.clock.now();
    const token = await this.deps.invitationTokens.findByHash(
      this.deps.opaqueTokens.hash(command.token),
    );
    if (!token?.isUsable(now)) throw new InvalidInvitationError();

    const account = await this.deps.accounts.findById(token.userId);
    if (account?.status !== 'invited') throw new InvalidInvitationError();

    const passwordHash = await this.deps.hasher.hash(command.newPassword);
    const accepted = await this.deps.tx.run(async () => {
      if (!(await this.deps.invitationTokens.consumeIfUnused(token.id, now))) return false;
      if (!(await this.deps.accounts.activate(account.id, passwordHash))) return false;
      await this.deps.lockouts.clear(account.id);
      await this.deps.audit.record({
        actorId: account.id,
        actorIp: command.ip,
        action: 'user.invitation_accepted',
        targetType: 'user',
        targetId: account.id,
        summary: {},
      });
      return true;
    });
    if (!accepted) throw new InvalidInvitationError();
  }
}
