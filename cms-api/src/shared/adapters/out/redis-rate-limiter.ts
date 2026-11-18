import type { Redis } from 'ioredis';
import type { Logger, RateLimitDecision, RateLimiter } from '../../ports/system.port.js';

// Atomic, so concurrent requests cannot both read the same count.
const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('TTL', KEYS[1])}
`;

export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: Pick<Redis, 'eval'>,
    private readonly logger: Logger,
  ) {}

  // Fails open: an outage must not lock everyone out of login, and account lockout lives in the
  // database so it still applies.
  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    try {
      const [count, ttl] = (await this.redis.eval(CONSUME_SCRIPT, 1, key, windowSeconds)) as [
        number,
        number,
      ];
      const allowed = count <= limit;
      return { allowed, retryAfterSeconds: allowed ? 0 : Math.max(ttl, 1) };
    } catch (error) {
      this.logger.error('Rate limiter unavailable', { error: String(error) });
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }
}
