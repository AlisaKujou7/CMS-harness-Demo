import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { RedisRateLimiter } from '../../../src/shared/adapters/out/redis-rate-limiter.js';
import { InMemoryLogger } from '../../fakes/system.fakes.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

describe('RedisRateLimiter', () => {
  let redis: Redis;
  const key = () => `test:${randomUUID()}`;

  beforeAll(() => {
    redis = new Redis(inject('redisUrl'));
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('allows up to the limit and then rejects', async () => {
    const limiter = new RedisRateLimiter(redis, new InMemoryLogger());
    const name = key();

    const decisions = [];
    for (let i = 0; i < 3; i += 1) decisions.push(await limiter.consume(name, 2, 60));

    expect(decisions.map((d) => d.allowed)).toEqual([true, true, false]);
    expect(decisions[0]?.retryAfterSeconds).toBe(0);
    expect(decisions[2]?.retryAfterSeconds).toBeGreaterThan(0);
    expect(decisions[2]?.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('counts atomically under concurrent requests', async () => {
    const limiter = new RedisRateLimiter(redis, new InMemoryLogger());
    const name = key();

    const decisions = await Promise.all(
      Array.from({ length: 20 }, () => limiter.consume(name, 5, 60)),
    );

    expect(decisions.filter((d) => d.allowed)).toHaveLength(5);
  });

  it('starts a new window after the old one expires', async () => {
    const limiter = new RedisRateLimiter(redis, new InMemoryLogger());
    const name = key();

    await limiter.consume(name, 1, 1);
    await expect(limiter.consume(name, 1, 1)).resolves.toMatchObject({ allowed: false });
    await redis.del(name);

    await expect(limiter.consume(name, 1, 1)).resolves.toMatchObject({ allowed: true });
  });

  it('keeps separate counters per key', async () => {
    const limiter = new RedisRateLimiter(redis, new InMemoryLogger());

    await limiter.consume(key(), 1, 60);

    await expect(limiter.consume(key(), 1, 60)).resolves.toMatchObject({ allowed: true });
  });

  it('fails open and logs when Redis is unreachable, since lockout still protects logins', async () => {
    const down = new Redis({
      host: '127.0.0.1',
      port: 1,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    down.on('error', () => undefined);
    const logger = new InMemoryLogger();
    const limiter = new RedisRateLimiter(down, logger);

    await expect(limiter.consume('any', 1, 60)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(logger.errors[0]?.message).toBe('Rate limiter unavailable');
    down.disconnect();
  });
});

describe('PrismaContext connectivity', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(() => db.close());

  it('reports the database as reachable', async () => {
    await expect(db.context.ping()).resolves.toBeUndefined();
  });
});
