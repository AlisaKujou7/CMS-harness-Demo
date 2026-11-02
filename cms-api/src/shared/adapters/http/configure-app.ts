import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { Logger } from '../../ports/system.port.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import type { HttpConfig } from './tokens.js';

const SAFE_REQUEST_ID = /^[\w-]{1,128}$/;
// A long article as a rich text tree is far larger than its text. Media never passes through here.
const JSON_BODY_LIMIT = '2mb';

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
  // One hop when nginx is in front (07-OPS-ARCH 5.5). Without a proxy the header is client input,
  // and honoring it would let anyone choose the IP that rate limits and audit events see.
  (app.getHttpAdapter().getInstance() as Express).set(
    'trust proxy',
    infrastructure.http.trustProxy ? 1 : false,
  );
  (app as NestExpressApplication).useBodyParser('json', { limit: JSON_BODY_LIMIT });
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
