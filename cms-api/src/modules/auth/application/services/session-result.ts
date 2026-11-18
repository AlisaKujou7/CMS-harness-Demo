import type { Account } from '../../domain/entities/account.entity.js';
import type { AuthDeps } from '../auth-deps.js';
import type { SessionResult } from '../ports/in/auth.ports.js';

export async function toSessionResult(
  deps: Pick<AuthDeps, 'signer' | 'config'>,
  account: Account,
  refreshToken: string,
): Promise<SessionResult> {
  const ttlSeconds = deps.config.accessTokenTtlSeconds;
  const claims = { userId: account.id, role: account.role };
  return {
    accessToken: await deps.signer.sign(claims, ttlSeconds),
    expiresInSeconds: ttlSeconds,
    refreshToken,
    user: { id: account.id, email: account.email, name: account.name, role: account.role },
  };
}
