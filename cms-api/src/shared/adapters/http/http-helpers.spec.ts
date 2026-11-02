import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, ForbiddenError, UnauthenticatedError } from '../../kernel/app-error.js';
import { actorOf, clientIpOf, RequireRoles, RolesGuard } from './authentication.js';
import { parseInput } from './validation.js';

class Handlers {
  @RequireRoles('admin')
  adminOnly(): void {
    return undefined;
  }

  open(): void {
    return undefined;
  }
}

const contextFor = (request: object, handler: () => void = Handlers.prototype.open) =>
  ({
    getHandler: () => handler,
    getClass: () => Handlers,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('actorOf', () => {
  it('returns the authenticated actor', () => {
    const actor = { id: 'u', role: 'admin' };

    expect(actorOf(contextFor({ actor }))).toBe(actor);
  });

  it('refuses a route that forgot the authentication guard', () => {
    expect(() => actorOf(contextFor({}))).toThrow(UnauthenticatedError);
  });
});

describe('clientIpOf', () => {
  it('returns the request IP', () => {
    expect(clientIpOf(contextFor({ ip: '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('returns null when the IP is unknown', () => {
    expect(clientIpOf(contextFor({}))).toBeNull();
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows a route with no role requirement', () => {
    expect(guard.canActivate(contextFor({}))).toBe(true);
  });

  it('allows a matching role', () => {
    const context = contextFor({ actor: { id: 'u', role: 'admin' } }, Handlers.prototype.adminOnly);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('forbids another role', () => {
    const context = contextFor(
      { actor: { id: 'u', role: 'editor' } },
      Handlers.prototype.adminOnly,
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });
});

describe('parseInput', () => {
  const schema = z.object({ name: z.string() });

  it('treats a missing body as an empty object', () => {
    expect(() => parseInput(schema, undefined)).toThrow(AppError);
    expect(parseInput(z.object({}), undefined)).toEqual({});
  });

  it('names the failing field', () => {
    try {
      parseInput(schema, { name: 1 });
      expect.unreachable();
    } catch (error) {
      expect((error as AppError).details).toEqual({ field: 'name' });
    }
  });

  it('reports no field when the whole input is wrong', () => {
    try {
      parseInput(schema, 'text');
      expect.unreachable();
    } catch (error) {
      expect((error as AppError).details).toEqual({ field: '' });
    }
  });
});
