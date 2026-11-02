import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createAppModule, type Infrastructure } from '../../src/composition/app.module.js';
import { configureApp } from '../../src/shared/adapters/http/configure-app.js';
import { FakeReadinessProbe, InMemoryRateLimiter } from '../fakes/system.fakes.js';
import { createAuthContext } from './auth-context.js';

export const CSRF_HEADER = { 'X-Requested-With': 'cms-admin' } as const;

export function createFakeInfrastructure() {
  const ctx = createAuthContext();
  const infrastructure = {
    ...ctx,
    rateLimiter: new InMemoryRateLimiter(),
    readiness: new FakeReadinessProbe(),
    http: {
      secureCookies: true,
      corsOrigins: ['https://cms.example.com'],
      rateLimits: {
        login: { limit: 10, windowSeconds: 60 },
        passwordReset: { limit: 5, windowSeconds: 3600 },
      },
    },
  } satisfies Infrastructure;
  return infrastructure;
}

export type FakeInfrastructure = ReturnType<typeof createFakeInfrastructure>;

export async function createTestApp(
  infrastructure: Infrastructure,
  extraControllers: Type[] = [],
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(infrastructure)],
    controllers: extraControllers,
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, infrastructure);
  await app.init();
  return app;
}

export function http(app: INestApplication) {
  return request(app.getHttpServer() as Parameters<typeof request>[0]);
}
