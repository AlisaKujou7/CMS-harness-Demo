import type { Actor } from '../../../../shared/kernel/actor.js';
import type { AccessTokenAuthenticator } from '../../../../shared/ports/access-token-authenticator.port.js';
import { InvalidAccessTokenError } from '../../domain/errors/auth.errors.js';
import type { AuthDeps } from '../auth-deps.js';

export class AuthenticateAccessToken implements AccessTokenAuthenticator {
  constructor(private readonly deps: AuthDeps) {}

  // Reads the account on every request, so deactivation and role changes apply at once instead of
  // when the token expires (UR-A03).
  async authenticate(token: string): Promise<Actor> {
    const claims = await this.deps.signer.verify(token);
    if (!claims) throw new InvalidAccessTokenError();

    const account = await this.deps.accounts.findById(claims.userId);
    if (!account?.canLogin()) throw new InvalidAccessTokenError();
    return { id: account.id, role: account.role };
  }
}
