import type { Actor } from '../../../../shared/kernel/actor.js';
import { ApiKey } from '../../domain/entities/api-key.entity.js';
import type { AuthDeps } from '../auth-deps.js';
import { assertCanManageApiKeys } from '../policies/api-key.policy.js';
import type { ApiKeySummary, CreateApiKeyUseCase } from '../ports/in/auth.ports.js';
import { toApiKeySummary } from './list-api-keys.use-case.js';

const KEY_PREFIX = 'cmsk_';
const VISIBLE_PREFIX_LENGTH = 12;

export class CreateApiKey implements CreateApiKeyUseCase {
  constructor(private readonly deps: AuthDeps) {}

  async execute(command: {
    readonly actor: Actor;
    readonly name: string;
    readonly ip: string | null;
  }): Promise<ApiKeySummary & { readonly key: string }> {
    assertCanManageApiKeys(command.actor);

    const key = `${KEY_PREFIX}${this.deps.opaqueTokens.generate()}`;
    const apiKey = ApiKey.create({
      id: this.deps.ids.next(),
      name: command.name,
      prefix: key.slice(0, VISIBLE_PREFIX_LENGTH),
      keyHash: this.deps.opaqueTokens.hash(key),
      createdBy: command.actor.id,
      now: this.deps.clock.now(),
    });

    await this.deps.apiKeys.save(apiKey);
    await this.deps.audit.record({
      actorId: command.actor.id,
      actorIp: command.ip,
      action: 'api_key.create',
      targetType: 'api_key',
      targetId: apiKey.id,
      summary: { name: apiKey.name, prefix: apiKey.prefix },
    });
    return { ...toApiKeySummary(apiKey), key };
  }
}
