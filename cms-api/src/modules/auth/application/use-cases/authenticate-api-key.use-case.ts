import { InvalidApiKeyError } from '../../domain/errors/auth.errors.js';
import type { AuthDeps } from '../auth-deps.js';
import type { AuthenticateApiKeyUseCase } from '../ports/in/auth.ports.js';

const LAST_USED_WRITE_INTERVAL_MS = 60_000;

export class AuthenticateApiKey implements AuthenticateApiKeyUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(key: string): Promise<{ readonly apiKeyId: string }> {
    const apiKey = await this.deps.apiKeys.findByHash(this.deps.opaqueTokens.hash(key));
    if (!apiKey?.isActive()) throw new InvalidApiKeyError();

    const now = this.deps.clock.now();
    const lastUsedMs = apiKey.lastUsedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (now.getTime() - lastUsedMs >= LAST_USED_WRITE_INTERVAL_MS) {
      await this.deps.apiKeys.touchLastUsed(apiKey.id, now);
    }
    return { apiKeyId: apiKey.id };
  }
}
