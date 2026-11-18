import { Email } from '../../../../shared/kernel/email.js';
import type { AuditEventInput } from '../../../../shared/ports/system.port.js';
import type { Account } from '../../domain/entities/account.entity.js';
import { RefreshToken } from '../../domain/entities/refresh-token.entity.js';
import { InvalidCredentialsError } from '../../domain/errors/auth.errors.js';
import type { AuthDeps } from '../auth-deps.js';
import type { LoginCommand, LoginUseCase, SessionResult } from '../ports/in/auth.ports.js';
import { admitPasswordAttempt } from '../services/password-attempts.js';
import { toSessionResult } from '../services/session-result.js';

export class Login implements LoginUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(command: LoginCommand): Promise<SessionResult> {
    const account = await this.findAccount(command.email);
    if (!account) return this.rejectUnknownAccount(command);

    if (!(await admitPasswordAttempt(this.deps, account.id))) {
      await this.deps.hasher.verifyAgainstNothing(command.password);
      await this.audit(account, command, 'auth.login.locked', {});
      throw new InvalidCredentialsError();
    }

    if (!(await this.passwordMatches(account, command.password))) {
      await this.audit(account, command, 'auth.login.failure', { reason: 'bad_credentials' });
      throw new InvalidCredentialsError();
    }

    return this.deps.tx.run(() => this.startSession(account, command));
  }

  private findAccount(rawEmail: string): Promise<Account | null> {
    const email = Email.parse(rawEmail);
    return email ? this.deps.accounts.findByEmail(email.value) : Promise.resolve(null);
  }

  private async rejectUnknownAccount(command: LoginCommand): Promise<never> {
    await this.deps.hasher.verifyAgainstNothing(command.password);
    await this.deps.audit.record({
      actorId: null,
      actorIp: command.ip,
      action: 'auth.login.failure',
      targetType: null,
      targetId: null,
      summary: { reason: 'unknown_account' },
    });
    throw new InvalidCredentialsError();
  }

  private async passwordMatches(account: Account, password: string): Promise<boolean> {
    if (account.passwordHash === null) {
      await this.deps.hasher.verifyAgainstNothing(password);
      return false;
    }
    const matches = await this.deps.hasher.verify(account.passwordHash, password);
    return matches && account.canLogin();
  }

  private async startSession(account: Account, command: LoginCommand): Promise<SessionResult> {
    const now = this.deps.clock.now();
    const rawToken = this.deps.opaqueTokens.generate();
    await this.deps.refreshTokens.save(
      RefreshToken.issue({
        id: this.deps.ids.next(),
        userId: account.id,
        familyId: this.deps.ids.next(),
        tokenHash: this.deps.opaqueTokens.hash(rawToken),
        now,
        ttlMs: this.deps.config.refreshTokenTtlMs,
      }),
    );
    await this.deps.lockouts.clear(account.id);
    await this.deps.accounts.recordLogin(account.id, now);
    await this.audit(account, command, 'auth.login.success', {});
    return toSessionResult(this.deps, account, rawToken);
  }

  private audit(
    account: Account,
    command: LoginCommand,
    action: string,
    summary: AuditEventInput['summary'],
  ): Promise<void> {
    return this.deps.audit.record({
      actorId: account.id,
      actorIp: command.ip,
      action,
      targetType: 'user',
      targetId: account.id,
      summary,
    });
  }
}
