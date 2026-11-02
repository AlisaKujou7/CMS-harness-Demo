import type { Account } from '../../domain/entities/account.entity.js';
import type { RefreshToken } from '../../domain/entities/refresh-token.entity.js';
import { InvalidRefreshTokenError } from '../../domain/errors/auth.errors.js';
import type { AuthDeps } from '../auth-deps.js';
import type {
  RefreshTokenUseCase,
  SessionResult,
  SessionTokenCommand,
} from '../ports/in/auth.ports.js';
import { toSessionResult } from '../services/session-result.js';

export class RefreshTokenSession implements RefreshTokenUseCase {
  constructor(private readonly deps: AuthDeps) {}

  // A rejection is returned out of the transaction, not thrown inside it: revoking a compromised
  // token family has to commit even though the request fails.
  async execute(command: SessionTokenCommand): Promise<SessionResult> {
    const session = await this.deps.tx.run(() => this.rotate(command));
    if (!session) throw new InvalidRefreshTokenError();
    return session;
  }

  private async rotate(command: SessionTokenCommand): Promise<SessionResult | null> {
    const now = this.deps.clock.now();
    const token = await this.deps.refreshTokens.findByHash(
      this.deps.opaqueTokens.hash(command.refreshToken),
    );
    if (!token) return null;

    const state = token.state(now);
    if (state === 'revoked') return this.handleReuse(token, command);
    if (state === 'expired') return null;

    const account = await this.deps.accounts.findById(token.userId);
    if (!account?.canLogin()) {
      await this.deps.refreshTokens.revokeAllForUser(token.userId, now);
      return null;
    }

    const wonRotation = await this.deps.refreshTokens.revokeIfActive(token.id, now);
    if (!wonRotation) return this.handleReuse(token, command);
    return this.issueReplacement(token, account);
  }

  private async issueReplacement(token: RefreshToken, account: Account): Promise<SessionResult> {
    const rawToken = this.deps.opaqueTokens.generate();
    await this.deps.refreshTokens.save(
      token.rotate({
        id: this.deps.ids.next(),
        tokenHash: this.deps.opaqueTokens.hash(rawToken),
        now: this.deps.clock.now(),
      }),
    );
    return toSessionResult(this.deps, account, rawToken);
  }

  private async handleReuse(token: RefreshToken, command: SessionTokenCommand): Promise<null> {
    await this.deps.refreshTokens.revokeAllForUser(token.userId, this.deps.clock.now());
    await this.deps.audit.record({
      actorId: token.userId,
      actorIp: command.ip,
      action: 'auth.session.reuse_detected',
      targetType: 'user',
      targetId: token.userId,
      summary: {},
    });
    return null;
  }
}
