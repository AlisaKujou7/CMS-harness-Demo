import { defineConfig } from 'prisma/config';

// Runs as the database owner, which is the only role allowed to change the schema (ADR-0013).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? '' },
});
