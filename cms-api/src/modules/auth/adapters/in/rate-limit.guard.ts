import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  HTTP_CONFIG,
  type HttpConfig,
  RATE_LIMITER,
} from '../../../../shared/adapters/http/tokens.js';
import { RateLimitedError } from '../../../../shared/kernel/app-error.js';
import type { RateLimiter } from '../../../../shared/ports/system.port.js';

const RATE_LIMIT_POLICY = 'rateLimitPolicy';

type PolicyName = keyof HttpConfig['rateLimits'];

export const RateLimit = (policy: PolicyName) => SetMetadata(RATE_LIMIT_POLICY, policy);

// Limits per client IP (SEC-07).
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(HTTP_CONFIG) private readonly config: HttpConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const name = this.reflector.get<PolicyName | undefined>(
      RATE_LIMIT_POLICY,
      context.getHandler(),
    );
    if (name === undefined) return true;

    const { limit, windowSeconds } = this.config.rateLimits[name];
    const ip = context.switchToHttp().getRequest<Request>().ip ?? 'unknown';
    const decision = await this.limiter.consume(`rate:${name}:${ip}`, limit, windowSeconds);
    if (!decision.allowed) throw new RateLimitedError(decision.retryAfterSeconds);
    return true;
  }
}
