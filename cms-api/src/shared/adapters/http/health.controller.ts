import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { ReadinessProbe } from '../../ports/system.port.js';
import { READINESS_PROBE } from './tokens.js';

@Controller()
export class HealthController {
  constructor(@Inject(READINESS_PROBE) private readonly readiness: ReadinessProbe) {}

  @Get('healthz')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('readyz')
  async ready(@Res({ passthrough: true }) response: Response): Promise<{ status: string }> {
    if (await this.readiness.check()) return { status: 'ready' };
    response.status(503);
    return { status: 'unavailable' };
  }
}
