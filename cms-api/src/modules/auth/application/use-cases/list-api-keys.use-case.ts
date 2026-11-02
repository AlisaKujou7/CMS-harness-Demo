import type { Actor } from '../../../../shared/kernel/actor.js';
import type { ApiKey } from '../../domain/entities/api-key.entity.js';
import type { AuthDeps } from '../auth-deps.js';
import { assertCanManageApiKeys } from '../policies/api-key.policy.js';
import type { ApiKeySummary, ListApiKeysUseCase } from '../ports/in/auth.ports.js';

export function toApiKeySummary(key: ApiKey): ApiKeySummary {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
  };
}

export class ListApiKeys implements ListApiKeysUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(actor: Actor): Promise<readonly ApiKeySummary[]> {
    assertCanManageApiKeys(actor);
    const keys = await this.deps.apiKeys.findAll();
    return keys.map(toApiKeySummary);
  }
}
