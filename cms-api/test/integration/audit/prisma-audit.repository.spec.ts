import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaAuditLog } from '../../../src/modules/audit/adapters/out/persistence/prisma-audit-log.js';
import { FakeClock, SequentialIdGenerator } from '../../fakes/system.fakes.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const TARGET = '10000000-0000-4000-8000-000000000001';

describe('PrismaAuditLog', () => {
  let db: TestDatabase;
  const log = () => new PrismaAuditLog(db.context, new FakeClock(), new SequentialIdGenerator());
  const event = {
    actorId: TARGET,
    actorIp: '203.0.113.9',
    action: 'content.publish',
    targetType: 'content',
    targetId: TARGET,
    summary: { from: 'draft', to: 'published' },
  };

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(() => db.close());

  beforeEach(() => db.truncate());

  it('stores every field required by FR-AUDIT-01 with a UTC timestamp', async () => {
    await log().record(event);

    const rows = await db.context.client.auditEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ...event, occurredAt: new Date('2026-05-11T10:00:00.000Z') });
    expect(rows[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('stores system events with no actor', async () => {
    await log().record({
      ...event,
      actorId: null,
      actorIp: null,
      targetType: null,
      targetId: null,
    });

    const [row] = await db.context.client.auditEvent.findMany();
    expect(row).toMatchObject({ actorId: null, actorIp: null, targetType: null, targetId: null });
  });

  it('keeps earlier events when more are recorded', async () => {
    const audit = log();

    await audit.record(event);
    await audit.record({ ...event, action: 'content.unpublish' });

    await expect(db.context.client.auditEvent.count()).resolves.toBe(2);
  });

  it('exposes no way to change or remove an event (FR-AUDIT-03)', () => {
    const methods = Object.getOwnPropertyNames(PrismaAuditLog.prototype);

    expect(methods.sort()).toEqual(['constructor', 'record']);
  });

  it('joins the surrounding transaction', async () => {
    await expect(
      db.context.run(async () => {
        await log().record(event);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    await expect(db.context.client.auditEvent.count()).resolves.toBe(0);
  });
});
