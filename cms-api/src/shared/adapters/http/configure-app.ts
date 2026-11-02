import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { type Express, json, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import type { Logger } from '../../ports/system.port.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import type { HttpConfig } from './tokens.js';

const SAFE_REQUEST_ID = /^[\w-]{1,128}$/;
// A long article as a rich text tree is far larger than its text. Every other route keeps the
// 100 KB default, so anonymous callers cannot make the API parse large bodies. Media never passes
// through here.
const CONTENT_ROUTES = '/api/admin/content';
const CONTENT_BODY_LIMIT = '2mb';

// Runs first, and the default parser that Nest adds at init skips a body already parsed. It must
// not be registered as the bare parser: Nest finds one by name and would then add no default.
const contentBodyParser = json({ limit: CONTENT_BODY_LIMIT });
function parseContentBody(request: Request, response: Response, next: NextFunction): void {
  contentBodyParser(request, response, next);
}

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
  app.use(requestId);
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(CONTENT_ROUTES, parseContentBody);
  app.enableCors({ origin: [...infrastructure.http.corsOrigins], credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter(infrastructure.logger));
}
