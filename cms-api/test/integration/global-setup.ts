import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import pg from 'pg';
import { GenericContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    postgresAdminUrl: string;
    redisUrl: string;
    minioUrl: string;
  }
}

// One container per run. Each spec file gets its own database, so files can run in parallel.
export default async function globalSetup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis, minio] = await Promise.all([
    new PostgreSqlContainer('postgres:15-alpine').start(),
    new RedisContainer('redis:7-alpine').start(),
    // Official MinIO images are no longer public. This is the same server, for tests only.
    new GenericContainer('bitnamilegacy/minio:2025.7.23')
      .withEnvironment({
        MINIO_ROOT_USER: 'test-only-key',
        MINIO_ROOT_PASSWORD: 'test-only-secret',
      })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forHttp('/minio/health/live', 9000))
      .start(),
  ]);
  // Roles are cluster-wide. Creating it once here keeps parallel migrations from racing on it.
  const client = new pg.Client({ connectionString: postgres.getConnectionUri() });
  await client.connect();
  await client.query('CREATE ROLE cms_app NOLOGIN');
  await client.query("CREATE ROLE cms_app_login LOGIN PASSWORD 'test-only' IN ROLE cms_app");
  await client.end();

  project.provide('postgresAdminUrl', postgres.getConnectionUri());
  project.provide('redisUrl', redis.getConnectionUrl());
  project.provide('minioUrl', `http://${minio.getHost()}:${String(minio.getMappedPort(9000))}`);
  return async () => {
    await Promise.all([postgres.stop(), redis.stop(), minio.stop()]);
  };
}
