import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAuditEventReader } from '../../../../../test/fakes/audit.fakes.js';
import { InMemoryAuditLog } from '../../../../../test/fakes/system.fakes.js';
import type { Actor } from '../../../../shared/kernel/actor.js';
import { ForbiddenError } from '../../../../shared/kernel/app-error.js';
import { assertCanReadAudit } from '../policies/audit.policy.js';
import type { AuditEventView } from '../ports/out/audit-reader.port.js';
import { ExportAuditEvents, EXPORT_BATCH_SIZE } from './export-audit-events.use-case.js';
import { ListAuditEvents } from './list-audit-events.use-case.js';

const admin: Actor = { id: 'admin-1', role: 'admin' };
const nonAdmins: Actor[] = [
  { id: 'e', role: 'editor' },
  { id: 'a', role: 'author' },
];

const anEvent = (n: number, overrides: Partial<AuditEventView> = {}): AuditEventView => ({
  id: `event-${String(n)}`,
  occurredAt: new Date('2026-05-11T10:00:00Z'),
  actorId: 'u1',
  actorIp: '203.0.113.9',
  action: 'content.publish',
  targetType: 'content',
  targetId: 't1',
  summary: {},
  ...overrides,
});

const collect = async <T>(items: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const item of items) out.push(item);
  return out;
};

describe('assertCanReadAudit', () => {
  it('allows an admin and forbids others', () => {
    expect(() => {
      assertCanReadAudit(admin);
    }).not.toThrow();
    for (const actor of nonAdmins) {
      expect(() => {
        assertCanReadAudit(actor);
      }).toThrow(ForbiddenError);
    }
  });
});

describe('audit use cases', () => {
  let reader: InMemoryAuditEventReader;
  let audit: InMemoryAuditLog;

  beforeEach(() => {
    reader = new InMemoryAuditEventReader();
    audit = new InMemoryAuditLog();
  });

  describe('ListAuditEvents (FR-AUDIT-05)', () => {
    const list = (actor: Actor = admin, criteria = {}, page?: number) =>
      new ListAuditEvents({ reader }).execute({
        actor,
        criteria,
        ...(page === undefined ? {} : { page, pageSize: 1 }),
      });

    it('applies the filters', async () => {
      reader.events.push(anEvent(1), anEvent(2, { action: 'user.create' }));

      const result = await list(admin, { action: 'user.create' });

      expect(result.items.map((event) => event.id)).toEqual(['event-2']);
      expect(result.total).toBe(1);
    });

    it('pages the results', async () => {
      reader.events.push(anEvent(1), anEvent(2));

      const result = await list(admin, {}, 2);

      expect(result).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
      expect(result.items.map((event) => event.id)).toEqual(['event-2']);
    });

    it('defaults to the first page of 25', async () => {
      await expect(list()).resolves.toMatchObject({ page: 1, pageSize: 25 });
    });

    it.each(nonAdmins)('is forbidden for $role', async (actor) => {
      await expect(list(actor)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('ExportAuditEvents (FR-AUDIT-06)', () => {
    const exportAll = (actor: Actor = admin, criteria = {}) =>
      new ExportAuditEvents({ reader, audit }).execute({ actor, criteria, ip: '203.0.113.9' });

    it('yields every event across batches, in order', async () => {
      const count = EXPORT_BATCH_SIZE * 2 + 1;
      for (let n = 0; n < count; n += 1) reader.events.push(anEvent(n));

      const events = await collect(await exportAll());

      expect(events.map((event) => event.id)).toEqual(reader.events.map((event) => event.id));
    });

    it('stops cleanly when the total is an exact number of batches', async () => {
      for (let n = 0; n < EXPORT_BATCH_SIZE; n += 1) reader.events.push(anEvent(n));

      await expect(collect(await exportAll())).resolves.toHaveLength(EXPORT_BATCH_SIZE);
    });

    it('applies the filters', async () => {
      reader.events.push(anEvent(1), anEvent(2, { actorId: 'other' }));

      const events = await collect(await exportAll(admin, { actorId: 'other' }));

      expect(events.map((event) => event.id)).toEqual(['event-2']);
    });

    it('audits who exported what, because an export moves the whole log', async () => {
      await exportAll(admin, { action: 'user.create' });

      expect(audit.events).toEqual([
        {
          actorId: 'admin-1',
          actorIp: '203.0.113.9',
          action: 'audit.export',
          targetType: null,
          targetId: null,
          summary: { criteria: { action: 'user.create' } },
        },
      ]);
    });

    it.each(nonAdmins)('is forbidden for $role before anything is read', async (actor) => {
      await expect(exportAll(actor)).rejects.toThrow(ForbiddenError);

      expect(audit.events).toEqual([]);
    });
  });
});
