import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter } from '../../../../../test/fakes/system.fakes.js';
import { RateLimitedError } from '../../../../shared/kernel/app-error.js';
import { RateLimit, RateLimitGuard } from './rate-limit.guard.js';

const http = {
  secureCookies: true,
  trustProxy: true,
  corsOrigins: [],
  rateLimits: {
    login: { limit: 1, windowSeconds: 60 },
    passwordReset: { limit: 5, windowSeconds: 3600 },
  },
};

class Handlers {
  @RateLimit('login')
  limited(): void {
    return undefined;
  }

  unlimited(): void {
    return undefined;
  }
}

const contextFor = (handler: () => void, ip?: string) =>
  ({
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  }) as unknown as ExecutionContext;

describe('RateLimitGuard', () => {
  const guard = () => new RateLimitGuard(new Reflector(), new InMemoryRateLimiter(), http);

  it('allows a handler with no policy', async () => {
    await expect(
      guard().canActivate(contextFor(Handlers.prototype.unlimited.bind(Handlers.prototype))),
    ).resolves.toBe(true);
  });

  it('allows up to the limit, then rejects with the wait time', async () => {
    const subject = guard();
    const context = contextFor(Handlers.prototype.limited, '203.0.113.1');

    await expect(subject.canActivate(context)).resolves.toBe(true);
    await expect(subject.canActivate(context)).rejects.toThrow(RateLimitedError);
  });

  it('counts each client IP separately', async () => {
    const subject = guard();

    await subject.canActivate(contextFor(Handlers.prototype.limited, '203.0.113.1'));

    await expect(
      subject.canActivate(contextFor(Handlers.prototype.limited, '203.0.113.2')),
    ).resolves.toBe(true);
  });

  it('counts requests with no known IP together', async () => {
    const subject = guard();
    await subject.canActivate(contextFor(Handlers.prototype.limited));

    await expect(subject.canActivate(contextFor(Handlers.prototype.limited))).rejects.toThrow(
      RateLimitedError,
    );
  });
});
