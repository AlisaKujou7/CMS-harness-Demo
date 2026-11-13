import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  HTTP_CONFIG,
  type HttpConfig,
  RATE_LIMITER,
} from '../../../../../shared/adapters/http/tokens.js';
import { RateLimitedError, UnauthenticatedError } from '../../../../../shared/kernel/app-error.js';
import type { RateLimiter } from '../../../../../shared/ports/system.port.js';

export const API_KEY_AUTHENTICATOR = Symbol('ApiKeyAuthenticator');

export interface ApiKeyAuthenticator {
  execute(key: string): Promise<{ readonly apiKeyId: string }>;
}

// FR-PUBAPI-02 and SEC-07. The limit is per key, since one server may serve many consumers.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(API_KEY_AUTHENTICATOR) private readonly authenticator: ApiKeyAuthenticator,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(HTTP_CONFIG) private readonly config: HttpConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = context.switchToHttp().getRequest<Request>().header('x-api-key');
    if (!key) throw new UnauthenticatedError();
    const { apiKeyId } = await this.authenticator.execute(key);

    const { limit, windowSeconds } = this.config.rateLimits.publicApi;
    const decision = await this.limiter.consume(`rate:public:${apiKeyId}`, limit, windowSeconds);
    if (!decision.allowed) throw new RateLimitedError(decision.retryAfterSeconds);
    return true;
  }
}
