import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { inject } from 'vitest';
import { PrismaContext } from '../../../src/shared/adapters/out/prisma-context.js';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', '..', 'prisma', 'migrations');
const TABLES = [
  'content_versions',
  'content',
  'audit_events',
  'api_keys',
  'password_reset_tokens',
  'invitation_tokens',
  'refresh_tokens',
  'login_lockouts',
  'users',
];

async function withClient(url: string, work: (client: pg.Client) => Promise<void>): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await work(client);
  } finally {
    await client.end();
  }
}

function migrationStatements(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8'));
}

export interface TestDatabase {
  readonly url: string;
  readonly context: PrismaContext;
  truncate(): Promise<void>;
  seedUser(id: string, overrides?: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const adminUrl = inject('postgresAdminUrl');
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  await withClient(adminUrl, (client) =>
    client.query(`CREATE DATABASE ${name}`).then(() => undefined),
  );

  const parsed = new URL(adminUrl);
  parsed.pathname = `/${name}`;
  const url = parsed.toString();
  await withClient(url, async (client) => {
    for (const sql of migrationStatements()) await client.query(sql);
  });

  const context = new PrismaContext(url);
  return {
    url,
    context,
    // Append-only triggers would refuse this. Replica mode skips them for this connection only.
    truncate: () =>
      withClient(url, async (client) => {
        await client.query(
          `SET session_replication_role = replica; TRUNCATE ${TABLES.join(', ')} CASCADE`,
        );
      }),
    seedUser: (id, overrides = {}) =>
      context.client.user
        .create({
          data: {
            id,
            email: `${id}@example.com`,
            name: 'Test User',
            passwordHash: 'stored-hash',
            role: 'editor',
            status: 'active',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
            ...overrides,
          },
        })
        .then(() => undefined),
    close: () => context.disconnect(),
  };
}
