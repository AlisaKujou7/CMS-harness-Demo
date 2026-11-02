import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Actor, UserRole } from '../../kernel/actor.js';
import { ForbiddenError, UnauthenticatedError } from '../../kernel/app-error.js';
import type { AccessTokenAuthenticator } from '../../ports/access-token-authenticator.port.js';
import { ACCESS_TOKEN_AUTHENTICATOR } from './tokens.js';

const REQUIRED_ROLES = 'requiredRoles';
const BEARER_PREFIX = 'Bearer ';
const CSRF_HEADER_VALUE = 'cms-admin';

interface AuthenticatedRequest extends Request {
  actor?: Actor;
}

export const RequireRoles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES, roles);

function requestOf(context: ExecutionContext): AuthenticatedRequest {
  return context.switchToHttp().getRequest<AuthenticatedRequest>();
}

export function actorOf(context: ExecutionContext): Actor {
  const { actor } = requestOf(context);
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

export function clientIpOf(context: ExecutionContext): string | null {
  return requestOf(context).ip ?? null;
}

export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  actorOf(context),
);

export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  clientIpOf(context),
);

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_AUTHENTICATOR)
    private readonly authenticator: AccessTokenAuthenticator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = requestOf(context);
    const header = request.header('authorization');
    if (!header?.startsWith(BEARER_PREFIX)) throw new UnauthenticatedError();
    request.actor = await this.authenticator.authenticate(header.slice(BEARER_PREFIX.length));
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(actorOf(context).role)) throw new ForbiddenError();
    return true;
  }
}

// Refresh and logout authenticate by cookie, so they need CSRF protection (SEC-11). A cross-site
// form cannot set this header, and CORS blocks scripts on other origins from setting it.
@Injectable()
export class CsrfHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (requestOf(context).header('x-requested-with') !== CSRF_HEADER_VALUE) {
      throw new ForbiddenError();
    }
    return true;
  }
}
