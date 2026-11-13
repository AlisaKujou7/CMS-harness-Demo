import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  AccessTokenGuard,
  ClientIp,
  CurrentActor,
  RequireRoles,
  RolesGuard,
} from '../../../../../shared/adapters/http/authentication.js';
import { parseId, parseInput } from '../../../../../shared/adapters/http/validation.js';
import type { Actor } from '../../../../../shared/kernel/actor.js';
import type { ApiKeySummary } from '../../../application/ports/in/auth.ports.js';
import { AUTH_USE_CASES, type AuthUseCases } from './auth.use-cases.js';

export const createApiKeyRequest = z.object({ name: z.string().max(1024) });

function toResponse(key: ApiKeySummary) {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    created_at: key.createdAt,
    last_used_at: key.lastUsedAt,
    revoked_at: key.revokedAt,
  };
}

@Controller('api/admin/api-keys')
@RequireRoles('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
export class ApiKeysController {
  constructor(@Inject(AUTH_USE_CASES) private readonly useCases: AuthUseCases) {}

  @Get()
  async list(@CurrentActor() actor: Actor) {
    const keys = await this.useCases.listApiKeys.execute(actor);
    return { data: keys.map(toResponse) };
  }

  @Post()
  async create(@Body() body: unknown, @CurrentActor() actor: Actor, @ClientIp() ip: string | null) {
    const { name } = parseInput(createApiKeyRequest, body);
    const created = await this.useCases.createApiKey.execute({ actor, name, ip });
    return { data: { ...toResponse(created), key: created.key } };
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(
    @Param('id') id: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.useCases.revokeApiKey.execute({ actor, id: parseId(id), ip });
  }
}
