import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  type INestApplication,
  Post,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createFakeInfrastructure,
  createTestApp,
  http,
  type FakeInfrastructure,
} from '../../../../test/builders/http-app.js';
import { AppError, type ErrorKind } from '../../kernel/app-error.js';

@Controller('boom')
class BoomController {
  @Get('crash')
  crash(): never {
    throw new Error('secret database detail');
  }

  @Get('thrown-string')
  thrownString(): never {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- covers non-Error throws from libraries
    throw 'plain string';
  }

  @Get('http')
  httpError(): never {
    throw new HttpException('teapot', HttpStatus.I_AM_A_TEAPOT);
  }

  @Get('app/:kind')
  appError(): never {
    throw new AppError({ kind: 'conflict', code: 'SLUG_TAKEN', message: 'Slug is taken' });
  }

  @Post('echo')
  echo(): { ok: boolean } {
    return { ok: true };
  }
}

const kinds = Object.entries({
  validation: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
}) as [ErrorKind, number][];

@Controller('kinds')
class KindsController {
  @Get('validation') validation(): never {
    throw this.make('validation');
  }
  @Get('unauthorized') unauthorized(): never {
    throw this.make('unauthorized');
  }
  @Get('forbidden') forbidden(): never {
    throw this.make('forbidden');
  }
  @Get('not_found') notFound(): never {
    throw this.make('not_found');
  }
  @Get('conflict') conflict(): never {
    throw this.make('conflict');
  }
  @Get('rate_limited') rateLimited(): never {
    throw this.make('rate_limited');
  }

  private make(kind: ErrorKind): AppError {
    return new AppError({ kind, code: 'X', message: 'y' });
  }
}

describe('HTTP platform', () => {
  let infra: FakeInfrastructure;
  let app: INestApplication;

  beforeEach(async () => {
    infra = createFakeInfrastructure();
    app = await createTestApp(infra, [BoomController, KindsController]);
  });

  afterEach(() => app.close());

  describe('error envelope (FR-PUBAPI-06)', () => {
    it.each(kinds)('maps %s to HTTP %i', async (kind, status) => {
      const res = await http(app).get(`/kinds/${kind}`).expect(status);

      expect(res.body).toEqual({ error: { code: 'X', message: 'y' } });
    });

    it('hides unexpected errors and logs them with the request id', async () => {
      const res = await http(app).get('/boom/crash').set('X-Request-Id', 'req-1').expect(500);

      expect(res.body).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
      });
      expect(JSON.stringify(res.body)).not.toContain('secret');
      expect(infra.logger.errors[0]).toMatchObject({
        message: 'Unhandled error',
        context: { requestId: 'req-1', error: 'secret database detail' },
      });
    });

    it('logs a thrown value that is not an Error', async () => {
      await http(app).get('/boom/thrown-string').expect(500);

      expect(infra.logger.errors[0]?.context).toMatchObject({ error: 'plain string' });
    });

    it('wraps framework errors in the envelope', async () => {
      const res = await http(app).get('/no/such/route').expect(404);

      expect(res.body).toEqual({
        error: { code: 'NOT_FOUND', message: 'Cannot GET /no/such/route' },
      });
    });

    it('names other framework errors by status', async () => {
      const res = await http(app).get('/boom/http').expect(418);

      expect(res.body).toEqual({ error: { code: 'HTTP_418', message: 'teapot' } });
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await http(app)
        .post('/boom/echo')
        .set('Content-Type', 'application/json')
        .send('{ not json')
        .expect(400);

      expect((res.body as { error: { code: string } }).error.code).toBe('BAD_REQUEST');
    });
  });

  describe('security headers (SEC-02)', () => {
    it('sets the baseline headers', async () => {
      const res = await http(app).get('/healthz');

      expect(res.headers['strict-transport-security']).toContain('max-age=');
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('does not advertise the framework', async () => {
      const res = await http(app).get('/healthz');

      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('request id', () => {
    it('generates an id when the client sends none', async () => {
      const res = await http(app).get('/healthz');

      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('echoes a client id', async () => {
      const res = await http(app).get('/healthz').set('X-Request-Id', 'abc-123');

      expect(res.headers['x-request-id']).toBe('abc-123');
    });

    it('replaces an id that could inject into logs', async () => {
      const res = await http(app)
        .get('/healthz')
        .set('X-Request-Id', `a b${'x'.repeat(200)}`);

      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('CORS', () => {
    it('allows a configured origin', async () => {
      const res = await http(app).get('/healthz').set('Origin', 'https://cms.example.com');

      expect(res.headers['access-control-allow-origin']).toBe('https://cms.example.com');
    });

    it('does not allow any other origin', async () => {
      const res = await http(app).get('/healthz').set('Origin', 'https://evil.example.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('health endpoints (NFR-AVAIL-05)', () => {
    it('reports liveness', async () => {
      const res = await http(app).get('/healthz').expect(200);

      expect(res.body).toEqual({ status: 'ok' });
    });

    it('reports ready when dependencies respond', async () => {
      const res = await http(app).get('/readyz').expect(200);

      expect(res.body).toEqual({ status: 'ready' });
    });

    it('reports 503 when a dependency is down', async () => {
      infra.readiness.ready = false;

      const res = await http(app).get('/readyz').expect(503);

      expect(res.body).toEqual({ status: 'unavailable' });
    });
  });
});
