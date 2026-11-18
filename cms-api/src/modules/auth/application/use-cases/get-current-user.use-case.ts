import type { Actor } from '../../../../shared/kernel/actor.js';
import { InvalidAccessTokenError } from '../../domain/errors/auth.errors.js';
import type { AuthDeps } from '../auth-deps.js';
import type { GetCurrentUserUseCase, SessionResult } from '../ports/in/auth.ports.js';

export class GetCurrentUser implements GetCurrentUserUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(actor: Actor): Promise<SessionResult['user']> {
    const account = await this.deps.accounts.findById(actor.id);
    if (!account) throw new InvalidAccessTokenError();
    return { id: account.id, email: account.email, name: account.name, role: account.role };
  }
}
