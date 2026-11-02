import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
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
import {
  pageOptions,
  pageQuery,
  toListResponse,
} from '../../../../../shared/adapters/http/pagination.js';
import { parseId, parseInput } from '../../../../../shared/adapters/http/validation.js';
import type { Actor } from '../../../../../shared/kernel/actor.js';
import type { UserSummary } from '../../../application/ports/in/users.ports.js';
import { USERS_USE_CASES, type UsersUseCases } from './users.use-cases.js';

const role = z.enum(['admin', 'editor', 'author']);
const name = z.string().max(1024);
const inviteRequest = z.object({ email: z.string().max(1024), role, name: name.optional() });
const updateRequest = z.object({ name: name.optional(), role: role.optional() });

function toResponse(user: UserSummary) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    last_login_at: user.lastLoginAt,
    created_at: user.createdAt,
  };
}

@Controller('api/admin/users')
@RequireRoles('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
export class UsersController {
  constructor(@Inject(USERS_USE_CASES) private readonly useCases: UsersUseCases) {}

  @Get()
  async list(@Query() query: unknown, @CurrentActor() actor: Actor) {
    const options = pageOptions(parseInput(pageQuery, query));
    const result = await this.useCases.list.execute({ actor, ...options });
    return toListResponse(result, toResponse);
  }

  @Post()
  async invite(@Body() body: unknown, @CurrentActor() actor: Actor, @ClientIp() ip: string | null) {
    const input = parseInput(inviteRequest, body);
    const user = await this.useCases.invite.execute({
      actor,
      ip,
      email: input.email,
      role: input.role,
      ...(input.name === undefined ? {} : { name: input.name }),
    });
    return { data: toResponse(user) };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ) {
    const input = parseInput(updateRequest, body);
    const user = await this.useCases.update.execute({
      actor,
      ip,
      id: parseId(id),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.role === undefined ? {} : { role: input.role }),
    });
    return { data: toResponse(user) };
  }

  @Post(':id/deactivate')
  @HttpCode(204)
  async deactivate(
    @Param('id') id: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.useCases.deactivate.execute({ actor, ip, id: parseId(id) });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.useCases.remove.execute({ actor, ip, id: parseId(id) });
  }

  @Post(':id/reset-password')
  @HttpCode(204)
  async resetPassword(
    @Param('id') id: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.useCases.requestPasswordReset.execute({ actor, ip, id: parseId(id) });
  }

  @Post(':id/resend-invite')
  @HttpCode(204)
  async resendInvite(
    @Param('id') id: string,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
  ): Promise<void> {
    await this.useCases.resendInvitation.execute({ actor, ip, id: parseId(id) });
  }
}
