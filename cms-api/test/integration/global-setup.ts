import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    postgresAdminUrl: string;
    redisUrl: string;
  }
}

// One container per run. Each spec file gets its own database, so files can run in parallel.
export default async function globalSetup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:15-alpine').start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);
  project.provide('postgresAdminUrl', postgres.getConnectionUri());
  project.provide('redisUrl', redis.getConnectionUrl());
  return async () => {
    await Promise.all([postgres.stop(), redis.stop()]);
  };
}
