import { type DynamicModule, Module } from '@nestjs/common';
import { ApiKeysController } from '../modules/auth/adapters/in/http/api-keys.controller.js';
import { AuthController } from '../modules/auth/adapters/in/http/auth.controller.js';
import {
  AUTH_USE_CASES,
  type AuthUseCases,
} from '../modules/auth/adapters/in/http/auth.use-cases.js';
import type { AuthDeps } from '../modules/auth/application/auth-deps.js';
import { AuthenticateAccessToken } from '../modules/auth/application/use-cases/authenticate-access-token.use-case.js';
import { ChangePassword } from '../modules/auth/application/use-cases/change-password.use-case.js';
import { CompletePasswordReset } from '../modules/auth/application/use-cases/complete-password-reset.use-case.js';
import { CreateApiKey } from '../modules/auth/application/use-cases/create-api-key.use-case.js';
import { ListApiKeys } from '../modules/auth/application/use-cases/list-api-keys.use-case.js';
import { Login } from '../modules/auth/application/use-cases/login.use-case.js';
import { Logout } from '../modules/auth/application/use-cases/logout.use-case.js';
import { RefreshTokenSession } from '../modules/auth/application/use-cases/refresh-token.use-case.js';
import { RequestPasswordReset } from '../modules/auth/application/use-cases/request-password-reset.use-case.js';
import { RevokeApiKey } from '../modules/auth/application/use-cases/revoke-api-key.use-case.js';
import { HealthController } from '../shared/adapters/http/health.controller.js';
import {
  ACCESS_TOKEN_AUTHENTICATOR,
  HTTP_CONFIG,
  type HttpConfig,
  RATE_LIMITER,
  READINESS_PROBE,
} from '../shared/adapters/http/tokens.js';
import type { RateLimiter, ReadinessProbe } from '../shared/ports/system.port.js';

export interface Infrastructure extends AuthDeps {
  readonly rateLimiter: RateLimiter;
  readonly readiness: ReadinessProbe;
  readonly http: HttpConfig;
}

function createAuthUseCases(deps: AuthDeps): AuthUseCases {
  return {
    login: new Login(deps),
    refresh: new RefreshTokenSession(deps),
    logout: new Logout(deps),
    requestPasswordReset: new RequestPasswordReset(deps),
    completePasswordReset: new CompletePasswordReset(deps),
    changePassword: new ChangePassword(deps),
    createApiKey: new CreateApiKey(deps),
    listApiKeys: new ListApiKeys(deps),
    revokeApiKey: new RevokeApiKey(deps),
  };
}

@Module({})
export class AppModule {}

// The composition root (04-ARCH 4.2): the only place that knows every adapter. Tests pass fakes
// through the same function, so they exercise the real wiring.
export function createAppModule(infrastructure: Infrastructure): DynamicModule {
  return {
    module: AppModule,
    global: true,
    controllers: [AuthController, ApiKeysController, HealthController],
    providers: [
      { provide: AUTH_USE_CASES, useValue: createAuthUseCases(infrastructure) },
      {
        provide: ACCESS_TOKEN_AUTHENTICATOR,
        useValue: new AuthenticateAccessToken(infrastructure),
      },
      { provide: RATE_LIMITER, useValue: infrastructure.rateLimiter },
      { provide: READINESS_PROBE, useValue: infrastructure.readiness },
      { provide: HTTP_CONFIG, useValue: infrastructure.http },
    ],
    exports: [ACCESS_TOKEN_AUTHENTICATOR],
  };
}
