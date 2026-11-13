import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Logger } from '../../ports/system.port.js';

// Health checks arrive every few seconds and would bury everything else.
const UNLOGGED_PATHS: ReadonlySet<string> = new Set(['/healthz', '/readyz']);

interface RequestWithActor extends Request {
  actor?: { readonly id: string };
}

// NFR-OBS-01. Fields are listed one by one, because SEC-14 keeps emails and addresses out of these
// logs, and the query string is left out since it can hold anything. Written when the response
// closes, so that it also covers a client that hung up, and the guards have named the user by then.
export function requestLog(logger: Logger): RequestHandler {
  return (request: RequestWithActor, response: Response, next: NextFunction) => {
    const path = request.path;
    if (UNLOGGED_PATHS.has(path)) {
      next();
      return;
    }
    const startedAt = performance.now();
    response.once('close', () => {
      const userId = request.actor?.id;
      logger.info('request', {
        request_id: response.getHeader('X-Request-Id'),
        method: request.method,
        path,
        status: response.statusCode,
        duration_ms: Math.round(performance.now() - startedAt),
        ...(userId === undefined ? {} : { user_id: userId }),
      });
    });
    next();
  };
}
