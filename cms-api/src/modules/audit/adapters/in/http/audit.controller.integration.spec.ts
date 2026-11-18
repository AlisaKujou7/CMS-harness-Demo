import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { anAccount } from '../../../../../../test/builders/auth-context.js';
import {
  createFakeInfrastructure,
  createTestApp,
  http,
  type FakeInfrastructure,
} from '../../../../../../test/builders/http-app.js';
import type { UserRole } from '../../../../../shared/kernel/actor.js';
import type { AuditEventView } from '../../../application/ports/out/audit-reader.port.js';

const AUDIT = '/api/admin/audit';
const EXPORT = `${AUDIT}/export.csv`;
const ACTOR = '11111111-1111-4111-8111-111111111111';

const anEvent = (overrides: Partial<AuditEventView> = {}): AuditEventView => ({
  id: 'e1',
  occurredAt: new Date('2026-05-11T10:00:00.000Z'),
  actorId: ACTOR,
  actorIp: '203.0.113.9',
  action: 'content.publish',
  targetType: 'content',
  targetId: ACTOR,
  summary: { from: 'draft' },
  ...overrides,
});

describe('audit endpoints', () => {
  let infra: FakeInfrastructure;
  let app: INestApplication;

  const bearer = async (role: UserRole) => {
    infra.accounts.add(anAccount({ id: `u-${role}`, email: `${role}@example.com`, role }));
    return `Bearer ${await infra.signer.sign({ userId: `u-${role}`, role }, 900)}`;
  };

  beforeEach(async () => {
    infra = createFakeInfrastructure();
    app = await createTestApp(infra);
  });

  afterEach(() => app.close());

  describe('authorization', () => {
    it.each([AUDIT, EXPORT])('%s returns 401 without a token', async (path) => {
      await http(app).get(path).expect(401);
    });

    it.each([
      ['editor', AUDIT],
      ['author', AUDIT],
      ['editor', EXPORT],
      ['author', EXPORT],
    ] as const)('%s on %s returns 403', async (role, path) => {
      await http(app)
        .get(path)
        .set('Authorization', await bearer(role))
        .expect(403);
    });
  });

  describe('append-only API (FR-AUDIT-03)', () => {
    it.each(['post', 'put', 'patch', 'delete'] as const)(
      '%s on an event is not routable, even for an admin',
      async (method) => {
        await http(app)
          [method](`${AUDIT}/${ACTOR}`)
          .set('Authorization', await bearer('admin'))
          .expect(404);
      },
    );
  });

  describe('GET /api/admin/audit', () => {
    it('returns events in the standard envelope', async () => {
      infra.auditReader.events.push(anEvent());

      const res = await http(app)
        .get(AUDIT)
        .set('Authorization', await bearer('admin'))
        .expect(200);

      expect(res.body).toEqual({
        data: [
          {
            id: 'e1',
            occurred_at: '2026-05-11T10:00:00.000Z',
            actor_id: ACTOR,
            actor_ip: '203.0.113.9',
            action: 'content.publish',
            target_type: 'content',
            target_id: ACTOR,
            summary: { from: 'draft' },
          },
        ],
        pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
      });
    });

    it('filters by actor, action, target and date range (FR-AUDIT-05)', async () => {
      infra.auditReader.events.push(
        anEvent({ id: 'keep' }),
        anEvent({ id: 'other-action', action: 'user.create' }),
        anEvent({ id: 'other-actor', actorId: null }),
        anEvent({ id: 'other-target', targetType: 'user' }),
        anEvent({ id: 'other-target-id', targetId: null }),
        anEvent({ id: 'too-old', occurredAt: new Date('2026-05-01T00:00:00Z') }),
        anEvent({ id: 'too-new', occurredAt: new Date('2026-06-01T00:00:00Z') }),
      );
      const query = new URLSearchParams({
        actor_id: ACTOR,
        action: 'content.publish',
        target_type: 'content',
        target_id: ACTOR,
        from: '2026-05-10T00:00:00Z',
        to: '2026-05-12T00:00:00Z',
      });

      const res = await http(app)
        .get(`${AUDIT}?${query.toString()}`)
        .set('Authorization', await bearer('admin'))
        .expect(200);

      const { data } = res.body as { data: { id: string }[] };
      expect(data.map((event) => event.id)).toEqual(['keep']);
    });

    it.each([
      ['actor_id=nope', 'actor_id'],
      ['target_id=nope', 'target_id'],
      ['from=yesterday', 'from'],
      ['to=tomorrow', 'to'],
    ])('returns 422 for %s', async (query, field) => {
      const res = await http(app)
        .get(`${AUDIT}?${query}`)
        .set('Authorization', await bearer('admin'))
        .expect(422);

      expect((res.body as { error: { details: unknown } }).error.details).toEqual({ field });
    });
  });

  describe('GET /api/admin/audit/export.csv (FR-AUDIT-06)', () => {
    const download = async () =>
      http(app)
        .get(EXPORT)
        .set('Authorization', await bearer('admin'))
        .expect(200);

    it('returns CSV as an attachment with a header row', async () => {
      infra.auditReader.events.push(anEvent());

      const res = await download();

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe('attachment; filename="audit-log.csv"');
      expect(res.text.split('\r\n')).toEqual([
        'id,occurred_at,actor_id,actor_ip,action,target_type,target_id,summary',
        `e1,2026-05-11T10:00:00.000Z,${ACTOR},203.0.113.9,content.publish,content,${ACTOR},"{""from"":""draft""}"`,
        '',
      ]);
    });

    it('leaves null fields empty', async () => {
      infra.auditReader.events.push(
        anEvent({ actorId: null, actorIp: null, targetType: null, targetId: null, summary: null }),
      );

      const res = await download();

      expect(res.text.split('\r\n')[1]).toBe(
        'e1,2026-05-11T10:00:00.000Z,,,content.publish,,,null',
      );
    });

    it('quotes commas, quotes and line breaks', async () => {
      infra.auditReader.events.push(anEvent({ action: 'a,"b"\nc', summary: 1 }));

      const res = await download();

      expect(res.text).toContain('"a,""b""\nc"');
    });

    it.each(['=1+1', '+1', '-1', '@cmd', '\tx'])(
      'neutralizes the spreadsheet formula "%s"',
      async (value) => {
        infra.auditReader.events.push(anEvent({ action: value, summary: 1 }));

        const res = await download();

        expect(res.text).toContain(`'${value}`);
      },
    );

    it('streams every batch', async () => {
      for (let n = 0; n < 501; n += 1)
        infra.auditReader.events.push(anEvent({ id: `e${String(n)}` }));

      const res = await download();

      expect(res.text.trim().split('\r\n')).toHaveLength(502);
    });

    it('aborts the download and logs when reading fails mid stream', async () => {
      for (let n = 0; n < 500; n += 1) {
        infra.auditReader.events.push(anEvent({ id: `e${String(n)}` }));
      }
      const batchAfter = infra.auditReader.batchAfter.bind(infra.auditReader);
      infra.auditReader.batchAfter = (criteria, afterId, limit) =>
        afterId === null
          ? batchAfter(criteria, afterId, limit)
          : Promise.reject(new Error('database gone'));

      const authorization = await bearer('admin');
      await expect(http(app).get(EXPORT).set('Authorization', authorization)).rejects.toThrow();

      expect(infra.logger.errors[0]).toMatchObject({
        message: 'Failed after the response started',
        context: { error: 'database gone' },
      });
    });

    it('applies the same filters as the list', async () => {
      infra.auditReader.events.push(anEvent(), anEvent({ id: 'skip', action: 'user.create' }));

      const res = await http(app)
        .get(`${EXPORT}?action=content.publish`)
        .set('Authorization', await bearer('admin'))
        .expect(200);

      expect(res.text).not.toContain('skip');
    });

    it('records who exported', async () => {
      await download();

      expect(infra.audit.actions()).toEqual(['audit.export']);
    });
  });
});
