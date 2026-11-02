import type { Redis } from 'ioredis';
import type { Logger } from '../../../../shared/ports/system.port.js';
import type { ResponseCache } from '../../application/ports/out/public-sources.port.js';

const GENERATION_KEY = 'public-cache:generation';

// Invalidating moves every key to a new generation, so one write clears the lot and the old
// entries simply expire. Fails open: during an outage the API is slower, not down.
export class RedisResponseCache implements ResponseCache {
  constructor(
    private readonly redis: Pick<Redis, 'get' | 'set' | 'incr'>,
    private readonly logger: Logger,
  ) {}

  private async entryKey(key: string): Promise<string> {
    const generation = (await this.redis.get(GENERATION_KEY)) ?? '0';
    return `public-cache:${generation}:${key}`;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(await this.entryKey(key));
    } catch (error) {
      this.logger.error('Public cache read failed', { error: String(error) });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(await this.entryKey(key), value, 'EX', ttlSeconds);
    } catch (error) {
      this.logger.error('Public cache write failed', { error: String(error) });
    }
  }

  async invalidateAll(): Promise<void> {
    try {
      await this.redis.incr(GENERATION_KEY);
    } catch (error) {
      this.logger.error('Public cache invalidation failed', { error: String(error) });
    }
  }
}
