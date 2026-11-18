import type { Redis } from 'ioredis';
import type { Logger } from '../../../../shared/ports/system.port.js';
import type { CacheEntry, ResponseCache } from '../../application/ports/out/public-sources.port.js';

const GENERATION_KEY = 'public-cache:generation';
const NOTHING: CacheEntry = { value: null, store: () => Promise.resolve() };

// Invalidating moves every key to a new generation, so one write clears the lot and the old
// entries simply expire. Fails open: during an outage the API is slower, not down.
export class RedisResponseCache implements ResponseCache {
  constructor(
    private readonly redis: Pick<Redis, 'get' | 'set' | 'incr'>,
    private readonly logger: Logger,
  ) {}

  // The entry stays in the generation it was looked up in. A response loaded before an invalidation
  // therefore lands in the old generation, where nothing reads it, and not in the new one.
  async lookup(key: string): Promise<CacheEntry> {
    try {
      const generation = (await this.redis.get(GENERATION_KEY)) ?? '0';
      const entryKey = `public-cache:${generation}:${key}`;
      return {
        value: await this.redis.get(entryKey),
        store: (value, ttlSeconds) => this.store(entryKey, value, ttlSeconds),
      };
    } catch (error) {
      this.logger.error('Public cache read failed', { error: String(error) });
      return NOTHING;
    }
  }

  private async store(entryKey: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(entryKey, value, 'EX', ttlSeconds);
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
