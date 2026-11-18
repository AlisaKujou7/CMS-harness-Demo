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

const KEYS = '/api/admin/api-keys';
const MISSING_ID = '11111111-1111-4111-8111-111111111111';

describe('API key endpoints', () => {
  let infra: FakeInfrastructure;
  let app: INestApplication;

  beforeEach(async () => {
    infra = createFakeInfrastructure();
    app = await createTestApp(infra);
  });

  afterEach(() => app.close());

  const bearer = async (role: UserRole) => {
    infra.accounts.add(anAccount({ id: `user-${role}`, email: `${role}@example.com`, role }));
    const token = await infra.signer.sign({ userId: `user-${role}`, role }, 900);
    return `Bearer ${token}`;
  };

  const createKey = async () =>
    http(app)
      .post(KEYS)
      .set('Authorization', await bearer('admin'))
      .send({ name: 'Production Web' })
      .expect(201);

  describe('authorization matrix', () => {
    it.each([
      ['admin', 'POST', KEYS, 201],
      ['editor', 'POST', KEYS, 403],
      ['author', 'POST', KEYS, 403],
      ['admin', 'GET', KEYS, 200],
      ['editor', 'GET', KEYS, 403],
      ['author', 'GET', KEYS, 403],
      ['admin', 'DELETE', `${KEYS}/${MISSING_ID}`, 404],
      ['editor', 'DELETE', `${KEYS}/${MISSING_ID}`, 403],
      ['author', 'DELETE', `${KEYS}/${MISSING_ID}`, 403],
    ] as const)('%s %s %s returns %i', async (role, method, path, expected) => {
      const authorization = await bearer(role);
      const client = http(app);
      const call =
        method === 'POST'
          ? client.post(path).send({ name: 'Key' })
          : method === 'GET'
            ? client.get(path)
            : client.delete(path);

      await call.set('Authorization', authorization).expect(expected);
    });

    it.each([
      ['POST', KEYS],
      ['GET', KEYS],
      ['DELETE', `${KEYS}/${MISSING_ID}`],
    ] as const)('%s %s returns 401 without a token', async (method, path) => {
      const client = http(app);
      const call =
        method === 'POST'
          ? client.post(path)
          : method === 'GET'
            ? client.get(path)
            : client.delete(path);

      await call.expect(401);
    });

    it('uses a generic body for 403 as FR-AUTHZ-05 requires', async () => {
      const res = await http(app)
        .get(KEYS)
        .set('Authorization', await bearer('editor'))
        .expect(403);

      expect(res.body).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
        },
      });
    });
  });

  it('returns the key once on creation', async () => {
    const res = await createKey();

    const { data } = res.body as { data: Record<string, unknown> };
    expect(data).toMatchObject({
      name: 'Production Web',
      prefix: 'cmsk_opaque-',
      last_used_at: null,
      revoked_at: null,
    });
    expect(data['key']).toBe('cmsk_opaque-1');
    expect(data['created_at']).toBe('2026-05-11T10:00:00.000Z');
  });

  it('lists keys without the key or its hash', async () => {
    await createKey();

    const res = await http(app)
      .get(KEYS)
      .set('Authorization', await bearer('admin'))
      .expect(200);

    const { data } = res.body as { data: Record<string, unknown>[] };
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ name: 'Production Web', prefix: 'cmsk_opaque-' });
    expect(JSON.stringify(res.body)).not.toContain('cmsk_opaque-1');
    expect(JSON.stringify(res.body)).not.toContain('sha:');
  });

  it('revokes a key', async () => {
    const created = await createKey();
    const { id } = (created.body as { data: { id: string } }).data;

    await http(app)
      .delete(`${KEYS}/${id}`)
      .set('Authorization', await bearer('admin'))
      .expect(204);

    const list = await http(app)
      .get(KEYS)
      .set('Authorization', await bearer('admin'));
    expect((list.body as { data: { revoked_at: string }[] }).data[0]?.revoked_at).toBe(
      '2026-05-11T10:00:00.000Z',
    );
  });

  it('returns 422 for an id that is not a UUID', async () => {
    const res = await http(app)
      .delete(`${KEYS}/not-a-uuid`)
      .set('Authorization', await bearer('admin'))
      .expect(422);

    expect((res.body as { error: { details: unknown } }).error.details).toEqual({ field: 'id' });
  });

  it('returns 422 for a blank name', async () => {
    const res = await http(app)
      .post(KEYS)
      .set('Authorization', await bearer('admin'))
      .send({ name: ' ' })
      .expect(422);

    expect((res.body as { error: { details: unknown } }).error.details).toEqual({ field: 'name' });
  });

  it('rejects a token with the wrong scheme', async () => {
    await http(app).get(KEYS).set('Authorization', 'Basic abc').expect(401);
  });

  it('rejects a forged token', async () => {
    await http(app).get(KEYS).set('Authorization', 'Bearer forged').expect(401);
  });

  it('rejects a deactivated user immediately', async () => {
    const authorization = await bearer('admin');
    infra.accounts.add(
      anAccount({
        id: 'user-admin',
        email: 'admin@example.com',
        role: 'admin',
        status: 'deactivated',
      }),
    );

    await http(app).get(KEYS).set('Authorization', authorization).expect(401);
  });
});
