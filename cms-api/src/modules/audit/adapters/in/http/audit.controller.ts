import { Controller, Get, Inject, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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
import { parseInput } from '../../../../../shared/adapters/http/validation.js';
import type { Actor } from '../../../../../shared/kernel/actor.js';
import type {
  AuditCriteria,
  AuditEventView,
} from '../../../application/ports/out/audit-reader.port.js';
import { streamCsv } from './audit-csv.js';
import { AUDIT_USE_CASES, type AuditUseCases } from './audit.use-cases.js';

const timestamp = z.iso.datetime({ offset: true });
export const auditCriteriaQuery = z.object({
  actor_id: z.uuid().optional(),
  action: z.string().max(200).optional(),
  target_type: z.string().max(200).optional(),
  target_id: z.uuid().optional(),
  from: timestamp.optional(),
  to: timestamp.optional(),
});

function parseCriteria(query: unknown): AuditCriteria {
  const input = parseInput(auditCriteriaQuery, query);
  return {
    ...(input.actor_id === undefined ? {} : { actorId: input.actor_id }),
    ...(input.action === undefined ? {} : { action: input.action }),
    ...(input.target_type === undefined ? {} : { targetType: input.target_type }),
    ...(input.target_id === undefined ? {} : { targetId: input.target_id }),
    ...(input.from === undefined ? {} : { from: new Date(input.from) }),
    ...(input.to === undefined ? {} : { to: new Date(input.to) }),
  };
}

function toResponse(event: AuditEventView) {
  return {
    id: event.id,
    occurred_at: event.occurredAt,
    actor_id: event.actorId,
    actor_ip: event.actorIp,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId,
    summary: event.summary,
  };
}

// Read-only on purpose. FR-AUDIT-03 forbids any route that changes or removes an event.
@Controller('api/admin/audit')
@RequireRoles('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
export class AuditController {
  constructor(@Inject(AUDIT_USE_CASES) private readonly useCases: AuditUseCases) {}

  @Get()
  async list(@Query() query: unknown, @CurrentActor() actor: Actor) {
    const criteria = parseCriteria(query);
    const options = pageOptions(parseInput(pageQuery, query));
    const result = await this.useCases.list.execute({ actor, criteria, ...options });
    return toListResponse(result, toResponse);
  }

  @Get('export.csv')
  async export(
    @Query() query: unknown,
    @CurrentActor() actor: Actor,
    @ClientIp() ip: string | null,
    @Res() response: Response,
  ): Promise<void> {
    const criteria = parseCriteria(query);
    const events = await this.useCases.export.execute({ actor, criteria, ip });

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
    await streamCsv(events, response);
  }
}
