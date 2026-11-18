import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaAuditEventReader } from '../../../src/modules/audit/adapters/out/persistence/prisma-audit-event-reader.js';
import { PrismaAuditLog } from '../../../src/modules/audit/adapters/out/persistence/prisma-audit-log.js';
import { PrismaAccountRepository } from '../../../src/modules/auth/adapters/out/persistence/prisma-account.repository.js';
import { PrismaInvitationTokenRepository } from '../../../src/modules/auth/adapters/out/persistence/prisma-invitation-token.repository.js';
import { InvitationToken } from '../../../src/modules/auth/domain/entities/invitation-token.entity.js';
import { PrismaUserRepository } from '../../../src/modules/users/adapters/out/persistence/prisma-user.repository.js';
import { UpdateUser } from '../../../src/modules/users/application/use-cases/update-user.use-case.js';
import { User } from '../../../src/modules/users/domain/entities/user.entity.js';
import {
  EmailTakenError,
  LastAdminError,
  UserInUseError,
} from '../../../src/modules/users/domain/errors/user.errors.js';
import { Email } from '../../../src/shared/kernel/email.js';
import { toPageRequest } from '../../../src/shared/kernel/paged-result.js';
import {
  FakeClock,
  InMemoryAuditLog,
  RecordingEventPublisher,
  SequentialIdGenerator,
} from '../../fakes/system.fakes.js';
import { createTestDatabase, type TestDatabase } from '../support/test-database.js';

const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const T0 = new Date('2026-05-11T10:00:00.000Z');
const later = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

describe('users and audit persistence', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(() => db.close());

  beforeEach(() => db.truncate());

  describe('PrismaUserRepository', () => {
    const repo = () => new PrismaUserRepository(db.context);
    const invited = (n: number, email = `user${String(n)}@example.com`) =>
      User.invite({ id: id(n), email: Email.create(email), role: 'author', now: later(n) });

    it('round-trips a new user', async () => {
      await repo().create(invited(1));

      await expect(repo().findById(id(1))).resolves.toEqual(invited(1));
      await expect(repo().findByEmail('user1@example.com')).resolves.toEqual(invited(1));
    });

    it('returns null when nothing matches', async () => {
      await expect(repo().findById(id(9))).resolves.toBeNull();
      await expect(repo().findByEmail('none@example.com')).resolves.toBeNull();
    });

    it('rejects a duplicate email (FR-USER-07)', async () => {
      await repo().create(invited(1, 'same@example.com'));

      await expect(repo().create(invited(2, 'same@example.com'))).rejects.toThrow(EmailTakenError);
    });

    it('rethrows other database errors from save', async () => {
      const bad = User.restore({ ...invited(1), id: 'not-a-uuid' });

      await expect(repo().create(bad)).rejects.not.toBeInstanceOf(EmailTakenError);
    });

    it('leaves fields out of the update alone', async () => {
      await db.seedUser(id(1), {
        email: 'owner@example.com',
        role: 'author',
        status: 'deactivated',
      });

      await repo().update(id(1), { name: 'Renamed', updatedAt: later(9) });

      const row = await db.context.client.user.findUniqueOrThrow({ where: { id: id(1) } });
      expect(row).toMatchObject({ name: 'Renamed', role: 'author', status: 'deactivated' });
    });

    it('updates owned fields without touching the password or login time', async () => {
      await db.seedUser(id(1), {
        email: 'owner@example.com',
        passwordHash: 'keep-me',
        lastLoginAt: T0,
      });
      const user = (await repo().findById(id(1))) as User;
      await new PrismaAccountRepository(db.context).recordLogin(id(1), later(5));

      await repo().update(user.id, { name: 'New Name', role: 'admin', updatedAt: later(9) });

      const row = await db.context.client.user.findUniqueOrThrow({ where: { id: id(1) } });
      expect(row).toMatchObject({
        name: 'New Name',
        role: 'admin',
        passwordHash: 'keep-me',
        lastLoginAt: later(5),
        updatedAt: later(9),
      });
    });

    it('pages newest first with the total', async () => {
      await repo().create(invited(1));
      await repo().create(invited(2));
      await repo().create(invited(3));

      const result = await repo().findMany(toPageRequest({ page: 2, pageSize: 2 }));

      expect(result.items.map((user) => user.id)).toEqual([id(1)]);
      expect(result).toMatchObject({ total: 3, totalPages: 2, page: 2 });
    });

    it('deletes a user and their tokens', async () => {
      await repo().create(invited(1));
      await new PrismaInvitationTokenRepository(db.context).save(
        InvitationToken.issue({ id: id(50), userId: id(1), tokenHash: 'h', now: T0 }),
      );

      await repo().delete(id(1));

      await expect(repo().findById(id(1))).resolves.toBeNull();
      await expect(db.context.client.invitationToken.count()).resolves.toBe(0);
    });

    it('refuses to delete a user who created an API key', async () => {
      await repo().create(invited(1));
      await db.context.client.apiKey.create({
        data: {
          id: id(60),
          name: 'K',
          prefix: 'p',
          keyHash: 'h',
          createdBy: id(1),
          createdAt: T0,
        },
      });

      await expect(repo().delete(id(1))).rejects.toThrow(UserInUseError);
    });

    it('rethrows other database errors from delete', async () => {
      await expect(repo().delete(id(99))).rejects.not.toBeInstanceOf(UserInUseError);
    });

    it('lists only active admins', async () => {
      await db.seedUser(id(1), { role: 'admin' });
      await db.seedUser(id(2), { role: 'admin', status: 'deactivated' });
      await db.seedUser(id(3), { role: 'editor' });

      await expect(repo().lockActiveAdminIds()).resolves.toEqual([id(1)]);
    });

    it('never lets two admins demote each other down to zero (FR-USER-04)', async () => {
      await db.seedUser(id(1), { role: 'admin' });
      await db.seedUser(id(2), { role: 'admin' });
      const useCase = new UpdateUser({
        users: repo(),
        tx: db.context,
        clock: new FakeClock(),
        ids: new SequentialIdGenerator(),
        audit: new InMemoryAuditLog(),
        events: new RecordingEventPublisher(),
      });
      const demote = (target: number, actor: number) =>
        useCase.execute({
          actor: { id: id(actor), role: 'admin' },
          id: id(target),
          role: 'editor',
          ip: null,
        });

      const results = await Promise.allSettled([demote(1, 2), demote(2, 1)]);

      const failures = results.filter((result) => result.status === 'rejected');
      expect(failures).toHaveLength(1);
      expect((failures[0] as PromiseRejectedResult).reason).toBeInstanceOf(LastAdminError);
      await expect(repo().lockActiveAdminIds()).resolves.toHaveLength(1);
    });
  });

  describe('PrismaInvitationTokenRepository and account activation', () => {
    const repo = () => new PrismaInvitationTokenRepository(db.context);
    const token = (n: number, userId = id(1)) =>
      InvitationToken.issue({ id: id(n), userId, tokenHash: `invite-${String(n)}`, now: T0 });

    beforeEach(async () => {
      await db.seedUser(id(1), { status: 'invited', passwordHash: null });
      await db.seedUser(id(2), { status: 'invited', passwordHash: null });
    });

    it('round-trips a token', async () => {
      await repo().save(token(10));

      await expect(repo().findByHash('invite-10')).resolves.toEqual(token(10));
      await expect(repo().findByHash('nope')).resolves.toBeNull();
    });

    it('lets exactly one concurrent acceptance win', async () => {
      await repo().save(token(10));

      const results = await Promise.all(
        Array.from({ length: 8 }, () => repo().consumeIfUnused(id(10), later(1))),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('invalidates only the open tokens of that user', async () => {
      await repo().save(token(10));
      await repo().save(token(11, id(2)));

      await repo().invalidateForUser(id(1), later(1));

      await expect(repo().findByHash('invite-10')).resolves.toMatchObject({ usedAt: later(1) });
      await expect(repo().findByHash('invite-11')).resolves.toMatchObject({ usedAt: null });
    });

    it('activates only an account that is still invited', async () => {
      await db.seedUser(id(3), { status: 'deactivated', passwordHash: null });

      const activated = await new PrismaAccountRepository(db.context).activate(id(3), 'new-hash');

      expect(activated).toBe(false);
      const row = await db.context.client.user.findUniqueOrThrow({ where: { id: id(3) } });
      expect(row).toMatchObject({ status: 'deactivated', passwordHash: null });
    });

    it('activates an invited account with its password', async () => {
      await expect(
        new PrismaAccountRepository(db.context).activate(id(1), 'new-hash'),
      ).resolves.toBe(true);

      const row = await db.context.client.user.findUniqueOrThrow({ where: { id: id(1) } });
      expect(row).toMatchObject({ status: 'active', passwordHash: 'new-hash' });
    });
  });

  describe('PrismaAuditEventReader', () => {
    const reader = () => new PrismaAuditEventReader(db.context);
    const seed = (n: number, overrides: Record<string, unknown> = {}) =>
      db.context.client.auditEvent.create({
        data: {
          id: id(n),
          occurredAt: later(n),
          actorId: id(100),
          actorIp: '203.0.113.9',
          action: 'content.publish',
          targetType: 'content',
          targetId: id(200),
          summary: { n },
          ...overrides,
        },
      });

    it('returns events newest first with paging', async () => {
      await seed(1);
      await seed(2);
      await seed(3);

      const result = await reader().list({}, toPageRequest({ page: 1, pageSize: 2 }));

      expect(result.items.map((event) => event.id)).toEqual([id(3), id(2)]);
      expect(result).toMatchObject({ total: 3, totalPages: 2 });
      expect(result.items[0]).toMatchObject({ summary: { n: 3 }, actorIp: '203.0.113.9' });
    });

    it.each([
      ['actor', { actorId: id(101) }, { actorId: id(101) }],
      ['action', { action: 'user.create' }, { action: 'user.create' }],
      ['target type', { targetType: 'user' }, { targetType: 'user' }],
      ['target id', { targetId: id(201) }, { targetId: id(201) }],
    ])('filters by %s', async (_name, criteria, overrides) => {
      await seed(1);
      await seed(2, overrides);

      const result = await reader().list(criteria, toPageRequest({}));

      expect(result.items.map((event) => event.id)).toEqual([id(2)]);
      expect(result.total).toBe(1);
    });

    it('treats the date range as inclusive at both ends', async () => {
      for (const n of [1, 2, 3, 4]) await seed(n);

      const result = await reader().list({ from: later(2), to: later(3) }, toPageRequest({}));

      expect(result.items.map((event) => event.id)).toEqual([id(3), id(2)]);
    });

    it('walks every event once in batches, including ties on time', async () => {
      for (const n of [1, 2, 3, 4, 5]) await seed(n, { occurredAt: T0 });

      const first = await reader().batchAfter({}, null, 2);
      const second = await reader().batchAfter({}, first.at(-1)?.id ?? null, 2);
      const third = await reader().batchAfter({}, second.at(-1)?.id ?? null, 2);

      const ids = [...first, ...second, ...third].map((event) => event.id);
      expect(new Set(ids).size).toBe(5);
    });
  });

  describe('append-only audit table (FR-AUDIT-03, SEC-13)', () => {
    const seedEvent = () =>
      new PrismaAuditLog(db.context, new FakeClock(), new SequentialIdGenerator()).record({
        actorId: null,
        actorIp: null,
        action: 'x',
        targetType: null,
        targetId: null,
        summary: {},
      });

    it('rejects an update even from the table owner', async () => {
      await seedEvent();

      await expect(
        db.context.client.$executeRawUnsafe(`UPDATE audit_events SET action = 'tampered'`),
      ).rejects.toThrow(/append-only/);
    });

    it('rejects a delete even from the table owner', async () => {
      await seedEvent();

      await expect(db.context.client.$executeRawUnsafe('DELETE FROM audit_events')).rejects.toThrow(
        /append-only/,
      );
    });

    it('rejects a truncate even from the table owner', async () => {
      await seedEvent();

      await expect(db.context.client.$executeRawUnsafe('TRUNCATE audit_events')).rejects.toThrow(
        /append-only/,
      );
    });

    describe('as the application role', () => {
      const asAppRole = async (sql: string) => {
        const client = new pg.Client({ connectionString: db.url });
        await client.connect();
        try {
          await client.query('SET ROLE cms_app');
          return await client.query(sql);
        } finally {
          await client.end();
        }
      };
      const insert = `INSERT INTO audit_events (id, occurred_at, action, summary)
        VALUES ('${id(1)}', now(), 'x', '{}')`;

      it('can insert and read', async () => {
        await asAppRole(insert);

        const result = await asAppRole('SELECT count(*)::int AS n FROM audit_events');
        expect(result.rows[0]).toEqual({ n: 1 });
      });

      it.each([
        ['update', `UPDATE audit_events SET action = 'y'`],
        ['delete', 'DELETE FROM audit_events'],
        ['truncate', 'TRUNCATE audit_events'],
      ])('has no permission to %s', async (_name, sql) => {
        await expect(asAppRole(sql)).rejects.toThrow(/permission denied/);
      });

      it('keeps normal access to other tables', async () => {
        await expect(asAppRole('SELECT count(*) FROM users')).resolves.toBeDefined();
      });
    });
  });
});
