import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { Logger } from '../../ports/system.port.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import type { HttpConfig } from './tokens.js';

const SAFE_REQUEST_ID = /^[\w-]{1,128}$/;

function requestId(request: Request, response: Response, next: NextFunction): void {
  const incoming = request.header('x-request-id');
  const id = incoming !== undefined && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  response.setHeader('X-Request-Id', id);
  next();
}

export function configureApp(
  app: INestApplication,
  infrastructure: { readonly logger: Logger; readonly http: HttpConfig },
): void {
  // nginx is the single proxy in front of the API (07-OPS-ARCH 5.5).
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);
  app.use(requestId);
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.enableCors({ origin: [...infrastructure.http.corsOrigins], credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter(infrastructure.logger));
}
