import { beforeEach, describe, expect, it } from 'vitest';
import {
  anAccount,
  createAuthContext,
  type AuthContext,
} from '../../../../../test/builders/auth-context.js';
import type { Actor } from '../../../../shared/kernel/actor.js';
import { ForbiddenError } from '../../../../shared/kernel/app-error.js';
import {
  ApiKeyNotFoundError,
  InvalidAccessTokenError,
  InvalidApiKeyError,
  InvalidApiKeyNameError,
} from '../../domain/errors/auth.errors.js';
import { AuthenticateAccessToken } from './authenticate-access-token.use-case.js';
import { AuthenticateApiKey } from './authenticate-api-key.use-case.js';
import { CreateApiKey } from './create-api-key.use-case.js';
import { ListApiKeys } from './list-api-keys.use-case.js';
import { RevokeApiKey } from './revoke-api-key.use-case.js';

const admin: Actor = { id: 'admin-1', role: 'admin' };
const nonAdmins: Actor[] = [
  { id: 'e', role: 'editor' },
  { id: 'a', role: 'author' },
];

describe('API key use cases', () => {
  let ctx: AuthContext;
  const create = (actor: Actor = admin, name = 'Production Web') =>
    new CreateApiKey(ctx).execute({ actor, name, ip: '203.0.113.9' });

  beforeEach(() => {
    ctx = createAuthContext();
  });

  describe('CreateApiKey', () => {
    it('returns the full key once with a recognizable prefix', async () => {
      const result = await create();

      expect(result.key).toBe('cmsk_opaque-1');
      expect(result.prefix).toBe('cmsk_opaque-');
      expect(result.name).toBe('Production Web');
      expect(result.createdAt).toEqual(ctx.clock.now());
      expect(result.revokedAt).toBeNull();
      expect(result.lastUsedAt).toBeNull();
    });

    it('stores only the hash of the key', async () => {
      const result = await create();

      const stored = ctx.apiKeys.keys.get(result.id);
      expect(stored?.keyHash).toBe('sha:cmsk_opaque-1');
      expect(JSON.stringify(stored)).not.toContain('"cmsk_opaque-1"');
      expect(stored?.createdBy).toBe('admin-1');
    });

    it('writes an audit event without the key', async () => {
      const result = await create();

      expect(ctx.audit.events).toEqual([
        {
          actorId: 'admin-1',
          actorIp: '203.0.113.9',
          action: 'api_key.create',
          targetType: 'api_key',
          targetId: result.id,
          summary: { name: 'Production Web', prefix: 'cmsk_opaque-' },
        },
      ]);
    });

    it.each(nonAdmins)('is forbidden for $role', async (actor) => {
      await expect(create(actor)).rejects.toThrow(ForbiddenError);

      expect(ctx.apiKeys.keys.size).toBe(0);
    });

    it('rejects an invalid name', async () => {
      await expect(create(admin, '  ')).rejects.toThrow(InvalidApiKeyNameError);
    });
  });

  describe('ListApiKeys', () => {
    it('lists keys without exposing the hash', async () => {
      const { id } = await create();

      const keys = await new ListApiKeys(ctx).execute(admin);

      expect(keys).toEqual([
        {
          id,
          name: 'Production Web',
          prefix: 'cmsk_opaque-',
          createdAt: ctx.clock.now(),
          lastUsedAt: null,
          revokedAt: null,
        },
      ]);
    });

    it.each(nonAdmins)('is forbidden for $role', async (actor) => {
      await expect(new ListApiKeys(ctx).execute(actor)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('RevokeApiKey', () => {
    const revoke = (id: string, actor: Actor = admin) =>
      new RevokeApiKey(ctx).execute({ actor, id, ip: '203.0.113.9' });

    it('stops the key from authenticating', async () => {
      const { id, key } = await create();

      await revoke(id);

      await expect(new AuthenticateApiKey(ctx).execute(key)).rejects.toThrow(InvalidApiKeyError);
    });

    it('writes an audit event', async () => {
      const { id } = await create();

      await revoke(id);

      expect(ctx.audit.events.at(-1)).toEqual({
        actorId: 'admin-1',
        actorIp: '203.0.113.9',
        action: 'api_key.revoke',
        targetType: 'api_key',
        targetId: id,
        summary: {},
      });
    });

    it('reports a missing key as not found', async () => {
      await expect(revoke('missing')).rejects.toThrow(ApiKeyNotFoundError);
    });

    it('describes a missing key with the not found kind', () => {
      expect(new ApiKeyNotFoundError().kind).toBe('not_found');
    });

    it.each(nonAdmins)('is forbidden for $role and leaves the key active', async (actor) => {
      const { id, key } = await create();

      await expect(revoke(id, actor)).rejects.toThrow(ForbiddenError);

      await expect(new AuthenticateApiKey(ctx).execute(key)).resolves.toEqual({ apiKeyId: id });
    });
  });

  describe('AuthenticateApiKey', () => {
    const authenticate = (key: string) => new AuthenticateApiKey(ctx).execute(key);

    it('accepts an active key', async () => {
      const { id, key } = await create();

      await expect(authenticate(key)).resolves.toEqual({ apiKeyId: id });
    });

    it('rejects an unknown key', async () => {
      await expect(authenticate('cmsk_unknown')).rejects.toThrow(InvalidApiKeyError);
    });

    it('describes a bad key as unauthenticated', () => {
      expect(new InvalidApiKeyError().kind).toBe('unauthorized');
    });

    it('records the last use', async () => {
      const { id, key } = await create();

      await authenticate(key);

      expect(ctx.apiKeys.keys.get(id)?.lastUsedAt).toEqual(ctx.clock.now());
    });

    it('cannot undo a revocation that lands while it is authenticating', async () => {
      const { id, key } = await create();
      const findByHash = ctx.apiKeys.findByHash.bind(ctx.apiKeys);
      ctx.apiKeys.findByHash = async (hash) => {
        const stale = await findByHash(hash);
        await new RevokeApiKey(ctx).execute({ actor: admin, id, ip: null });
        return stale;
      };

      await authenticate(key);

      expect(ctx.apiKeys.keys.get(id)?.isActive()).toBe(false);
    });

    it('writes last use at most once a minute to keep the read path cheap', async () => {
      const { id, key } = await create();
      await authenticate(key);
      const firstUse = ctx.clock.now();

      ctx.clock.advanceMs(59_999);
      await authenticate(key);
      expect(ctx.apiKeys.keys.get(id)?.lastUsedAt).toEqual(firstUse);

      ctx.clock.advanceMs(1);
      await authenticate(key);
      expect(ctx.apiKeys.keys.get(id)?.lastUsedAt).toEqual(ctx.clock.now());
    });
  });
});

describe('AuthenticateAccessToken', () => {
  let ctx: AuthContext;
  let authenticate: AuthenticateAccessToken;

  beforeEach(() => {
    ctx = createAuthContext();
    authenticate = new AuthenticateAccessToken(ctx);
    ctx.accounts.add(anAccount());
  });

  const tokenFor = () => ctx.signer.sign({ userId: 'user-1', role: 'editor' }, 900);

  it('returns the actor for a valid token', async () => {
    await expect(authenticate.authenticate(await tokenFor())).resolves.toEqual({
      id: 'user-1',
      role: 'editor',
    });
  });

  it('rejects a token that fails verification', async () => {
    await expect(authenticate.authenticate('forged')).rejects.toThrow(InvalidAccessTokenError);
  });

  it('describes a bad token as unauthenticated', () => {
    expect(new InvalidAccessTokenError().kind).toBe('unauthorized');
  });

  it('applies a role change immediately rather than trusting the token', async () => {
    const token = await tokenFor();
    ctx.accounts.add(anAccount({ role: 'author' }));

    await expect(authenticate.authenticate(token)).resolves.toEqual({
      id: 'user-1',
      role: 'author',
    });
  });

  it('rejects a deactivated user immediately (UR-A03)', async () => {
    const token = await tokenFor();
    ctx.accounts.add(anAccount({ status: 'deactivated' }));

    await expect(authenticate.authenticate(token)).rejects.toThrow(InvalidAccessTokenError);
  });

  it('rejects a token for a user who no longer exists', async () => {
    const token = await tokenFor();
    ctx.accounts.accounts.clear();

    await expect(authenticate.authenticate(token)).rejects.toThrow(InvalidAccessTokenError);
  });
});
