// Creates the first Admin, since nobody can invite users until one exists.
// Usage: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... pnpm seed:admin
import { loadEnv } from '../config/env.schema.js';
import { assertPasswordPolicy } from '../modules/auth/domain/value-objects/password.vo.js';
import { Email } from '../shared/kernel/email.js';
import { createInfrastructure } from './infrastructure.js';

const email = Email.create(process.env['SEED_ADMIN_EMAIL'] ?? '');
const password = process.env['SEED_ADMIN_PASSWORD'] ?? '';
assertPasswordPolicy(password);

const { infrastructure, db, dispose } = createInfrastructure(loadEnv(process.env));
const now = infrastructure.clock.now();

await db.client.user.upsert({
  where: { email: email.value },
  update: {},
  create: {
    id: infrastructure.ids.next(),
    email: email.value,
    name: process.env['SEED_ADMIN_NAME'] ?? 'Administrator',
    passwordHash: await infrastructure.hasher.hash(password),
    role: 'admin',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
});

infrastructure.logger.info('Admin account is ready');
await dispose();
