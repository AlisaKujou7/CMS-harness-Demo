import type { Actor } from '../../../../shared/kernel/actor.js';
import { ApiKeyNotFoundError } from '../../domain/errors/auth.errors.js';
import type { AuthDeps } from '../auth-deps.js';
import { assertCanManageApiKeys } from '../policies/api-key.policy.js';
import type { RevokeApiKeyUseCase } from '../ports/in/auth.ports.js';

export class RevokeApiKey implements RevokeApiKeyUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(command: {
    readonly actor: Actor;
    readonly id: string;
    readonly ip: string | null;
  }): Promise<void> {
    assertCanManageApiKeys(command.actor);

    const key = await this.deps.apiKeys.findById(command.id);
    if (!key) throw new ApiKeyNotFoundError();

    await this.deps.apiKeys.save(key.revoke(this.deps.clock.now()));
    await this.deps.audit.record({
      actorId: command.actor.id,
      actorIp: command.ip,
      action: 'api_key.revoke',
      targetType: 'api_key',
      targetId: key.id,
      summary: {},
    });
  }
}
