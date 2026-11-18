import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  anAccount,
  NEW_PASSWORD,
  VALID_PASSWORD,
} from '../../../../../../test/builders/auth-context.js';
import {
  createFakeInfrastructure,
  createTestApp,
  CSRF_HEADER,
  http,
  type FakeInfrastructure,
} from '../../../../../../test/builders/http-app.js';

const LOGIN = '/api/admin/auth/login';
const REFRESH = '/api/admin/auth/refresh';
const LOGOUT = '/api/admin/auth/logout';
const credentials = { email: 'alice@example.com', password: VALID_PASSWORD };

const cookieOf = (setCookie: unknown): string => {
  const [first] = setCookie as string[];
  return (first ?? '').split(';')[0] ?? '';
};

describe('auth endpoints', () => {
  let infra: FakeInfrastructure;
  let app: INestApplication;

  beforeEach(async () => {
    infra = createFakeInfrastructure();
    infra.accounts.add(anAccount());
    app = await createTestApp(infra);
  });

  afterEach(() => app.close());

  const logIn = () => http(app).post(LOGIN).send(credentials);

  describe('POST /api/admin/auth/login', () => {
    it('returns the access token and user, and keeps the refresh token out of the body', async () => {
      const res = await logIn().expect(200);

      expect(res.body).toEqual({
        data: {
          access_token: 'access-1',
          expires_in: 900,
          user: { id: 'user-1', email: 'alice@example.com', name: 'Alice', role: 'editor' },
        },
      });
      expect(JSON.stringify(res.body)).not.toContain('opaque-1');
    });

    it('sets the refresh token in an httpOnly, Secure, SameSite=Strict cookie', async () => {
      const res = await logIn().expect(200);

      const cookie = (res.headers['set-cookie'] as unknown as string[])[0] ?? '';
      expect(cookie).toContain('cms_refresh=opaque-1');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/admin/auth');
      expect(cookie).toContain(`Max-Age=${String(14 * 24 * 60 * 60)}`);
    });

    it('omits Secure when configured for local http', async () => {
      await app.close();
      app = await createTestApp({ ...infra, http: { ...infra.http, secureCookies: false } });

      const res = await logIn().expect(200);

      expect((res.headers['set-cookie'] as unknown as string[])[0]).not.toContain('Secure');
    });

    it('responds with JSON in utf-8', async () => {
      const res = await logIn();

      expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
    });

    it('returns a generic 401 for a wrong password', async () => {
      const res = await http(app)
        .post(LOGIN)
        .send({ ...credentials, password: 'wrong-password-1' })
        .expect(401);

      expect(res.body).toEqual({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect, or the account is unavailable',
        },
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('returns the same response for an unknown email', async () => {
      const wrong = await http(app)
        .post(LOGIN)
        .send({ ...credentials, password: 'wrong-password-1' });
      const unknown = await http(app)
        .post(LOGIN)
        .send({ ...credentials, email: 'nobody@example.com' });

      expect(unknown.status).toBe(wrong.status);
      expect(unknown.body).toEqual(wrong.body);
    });

    it('rejects the correct password during a lockout without revealing it', async () => {
      for (let i = 0; i < 5; i += 1) {
        await http(app)
          .post(LOGIN)
          .send({ ...credentials, password: 'wrong-password-1' })
          .expect(401);
      }

      const res = await logIn().expect(401);

      expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_CREDENTIALS');
    });

    it.each([
      ['a missing password', { email: 'alice@example.com' }, 'password'],
      ['a missing email', { password: 'x' }, 'email'],
      ['a non-string email', { email: 1, password: 'x' }, 'email'],
    ])('returns 422 for %s', async (_name, body, field) => {
      const res = await http(app).post(LOGIN).send(body).expect(422);

      expect((res.body as { error: unknown }).error).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { field },
      });
    });

    it('audits the client IP', async () => {
      await logIn().set('X-Forwarded-For', '198.51.100.7');

      expect(infra.audit.events[0]?.actorIp).toBe('198.51.100.7');
    });

    it('ignores X-Forwarded-For when not behind a trusted proxy', async () => {
      await app.close();
      app = await createTestApp({ ...infra, http: { ...infra.http, trustProxy: false } });

      await logIn().set('X-Forwarded-For', '198.51.100.7');

      expect(infra.audit.events[0]?.actorIp).not.toBe('198.51.100.7');
    });

    it('cannot dodge the rate limit by rotating X-Forwarded-For without a proxy', async () => {
      await app.close();
      app = await createTestApp({ ...infra, http: { ...infra.http, trustProxy: false } });
      for (let i = 0; i < 10; i += 1) {
        await logIn()
          .set('X-Forwarded-For', `198.51.100.${String(i)}`)
          .expect(200);
      }

      await logIn().set('X-Forwarded-For', '198.51.100.99').expect(429);
    });

    it('returns 429 with Retry-After on the 11th attempt in a minute (SEC-07)', async () => {
      for (let i = 0; i < 10; i += 1) await logIn().expect(200);

      const res = await logIn().expect(429);

      expect(res.headers['retry-after']).toBe('60');
      expect((res.body as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
    });
  });

  describe('POST /api/admin/auth/refresh', () => {
    it('rotates the cookie and returns a new access token', async () => {
      const login = await logIn();
      const cookie = cookieOf(login.headers['set-cookie']);

      const res = await http(app).post(REFRESH).set('Cookie', cookie).set(CSRF_HEADER).expect(200);

      expect((res.body as { data: { access_token: string } }).data.access_token).toBe('access-2');
      expect(cookieOf(res.headers['set-cookie'])).toBe('cms_refresh=opaque-2');
    });

    it('returns 401 without a cookie', async () => {
      const res = await http(app).post(REFRESH).set(CSRF_HEADER).expect(401);

      expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_SESSION');
    });

    it('finds the session cookie among other cookies', async () => {
      const login = await logIn();
      const cookie = cookieOf(login.headers['set-cookie']);

      await http(app)
        .post(REFRESH)
        .set('Cookie', `theme=dark; ${cookie}; other=1`)
        .set(CSRF_HEADER)
        .expect(200);
    });

    it('returns 403 without the CSRF header (SEC-11)', async () => {
      const login = await logIn();

      await http(app)
        .post(REFRESH)
        .set('Cookie', cookieOf(login.headers['set-cookie']))
        .expect(403);

      expect(infra.signer.signed).toHaveLength(1);
    });

    it('returns 403 for a wrong CSRF header value', async () => {
      await http(app).post(REFRESH).set('X-Requested-With', 'XMLHttpRequest').expect(403);
    });

    it('returns 401 when an old token is reused', async () => {
      const login = await logIn();
      const cookie = cookieOf(login.headers['set-cookie']);
      await http(app).post(REFRESH).set('Cookie', cookie).set(CSRF_HEADER).expect(200);
      infra.clock.advanceMs(10_000);

      await http(app).post(REFRESH).set('Cookie', cookie).set(CSRF_HEADER).expect(401);
    });
  });

  describe('POST /api/admin/auth/logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const login = await logIn();
      const cookie = cookieOf(login.headers['set-cookie']);

      const res = await http(app).post(LOGOUT).set('Cookie', cookie).set(CSRF_HEADER).expect(204);

      expect((res.headers['set-cookie'] as unknown as string[])[0]).toContain('cms_refresh=;');
      await http(app).post(REFRESH).set('Cookie', cookie).set(CSRF_HEADER).expect(401);
    });

    it('succeeds without a cookie', async () => {
      await http(app).post(LOGOUT).set(CSRF_HEADER).expect(204);
    });

    it('returns 403 without the CSRF header', async () => {
      await http(app).post(LOGOUT).expect(403);
    });
  });

  describe('password reset', () => {
    const FORGOT = '/api/admin/auth/password/forgot';
    const RESET = '/api/admin/auth/password/reset';

    it('returns 204 for known and unknown emails alike', async () => {
      await http(app).post(FORGOT).send({ email: 'alice@example.com' }).expect(204);
      await http(app).post(FORGOT).send({ email: 'nobody@example.com' }).expect(204);

      expect(infra.email.sent).toHaveLength(1);
    });

    it('resets the password with the emailed token', async () => {
      await http(app).post(FORGOT).send({ email: 'alice@example.com' }).expect(204);

      await http(app)
        .post(RESET)
        .send({ token: 'opaque-1', new_password: NEW_PASSWORD })
        .expect(204);

      await http(app)
        .post(LOGIN)
        .send({ email: 'alice@example.com', password: NEW_PASSWORD })
        .expect(200);
    });

    it('returns 422 with the field for a weak password', async () => {
      const res = await http(app)
        .post(RESET)
        .send({ token: 'opaque-1', new_password: 'short1' })
        .expect(422);

      expect((res.body as { error: { details: unknown } }).error.details).toEqual({
        field: 'password',
      });
    });

    it('returns 422 for an invalid token', async () => {
      const res = await http(app)
        .post(RESET)
        .send({ token: 'nope', new_password: NEW_PASSWORD })
        .expect(422);

      expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_RESET_TOKEN');
    });

    it('limits forgot requests to 5 an hour per IP (SEC-07)', async () => {
      for (let i = 0; i < 5; i += 1) {
        await http(app).post(FORGOT).send({ email: 'alice@example.com' }).expect(204);
      }

      const res = await http(app).post(FORGOT).send({ email: 'alice@example.com' }).expect(429);

      expect(res.headers['retry-after']).toBe('3600');
    });

    it('limits reset submissions as well', async () => {
      const submit = () => http(app).post(RESET).send({ token: 'x', new_password: NEW_PASSWORD });
      for (let i = 0; i < 5; i += 1) await submit().expect(422);

      await submit().expect(429);
    });
  });

  describe('invitations', () => {
    const ACCEPT = '/api/admin/auth/invitations/accept';

    beforeEach(() => {
      infra.accounts.add(anAccount({ status: 'invited', passwordHash: null }));
    });

    it('activates the account so it can log in', async () => {
      const { SendInvitation } =
        await import('../../../application/use-cases/send-invitation.use-case.js');
      await new SendInvitation(infra).execute({ userId: 'user-1', email: 'alice@example.com' });

      await http(app)
        .post(ACCEPT)
        .send({ token: 'opaque-1', new_password: NEW_PASSWORD })
        .expect(204);

      await http(app)
        .post(LOGIN)
        .send({ email: 'alice@example.com', password: NEW_PASSWORD })
        .expect(200);
    });

    it('returns 422 for an invalid token', async () => {
      const res = await http(app)
        .post(ACCEPT)
        .send({ token: 'nope', new_password: NEW_PASSWORD })
        .expect(422);

      expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_INVITATION');
    });

    it('has its own limit, so a shared office IP can onboard several people', async () => {
      const forgot = () =>
        http(app).post('/api/admin/auth/password/forgot').send({ email: 'x@example.com' });
      for (let i = 0; i < 5; i += 1) await forgot().expect(204);
      const submit = () => http(app).post(ACCEPT).send({ token: 'x', new_password: NEW_PASSWORD });

      for (let i = 0; i < 20; i += 1) await submit().expect(422);

      await submit().expect(429);
    });
  });

  describe('GET /api/admin/auth/me', () => {
    it('returns 401 without a token', async () => {
      await http(app).get('/api/admin/auth/me').expect(401);
    });

    it('returns the signed-in user', async () => {
      await logIn();

      const res = await http(app)
        .get('/api/admin/auth/me')
        .set('Authorization', 'Bearer access-1')
        .expect(200);

      expect(res.body).toEqual({
        data: { id: 'user-1', email: 'alice@example.com', name: 'Alice', role: 'editor' },
      });
    });
  });

  describe('POST /api/admin/auth/password/change', () => {
    const CHANGE = '/api/admin/auth/password/change';

    it('returns 401 without a token', async () => {
      await http(app)
        .post(CHANGE)
        .send({ current_password: VALID_PASSWORD, new_password: NEW_PASSWORD })
        .expect(401);
    });

    it('changes the password of the signed-in user', async () => {
      await logIn();

      await http(app)
        .post(CHANGE)
        .set('Authorization', 'Bearer access-1')
        .send({ current_password: VALID_PASSWORD, new_password: NEW_PASSWORD })
        .expect(204);

      await http(app)
        .post(LOGIN)
        .send({ email: 'alice@example.com', password: NEW_PASSWORD })
        .expect(200);
    });

    it('is rate limited per IP like login', async () => {
      await logIn();
      const guess = () =>
        http(app)
          .post(CHANGE)
          .set('Authorization', 'Bearer access-1')
          .send({ current_password: 'wrong-password-1', new_password: NEW_PASSWORD });
      for (let i = 0; i < 9; i += 1) await guess().expect(422);

      await guess().expect(429);
    });

    it('returns 422 for a wrong current password', async () => {
      await logIn();

      const res = await http(app)
        .post(CHANGE)
        .set('Authorization', 'Bearer access-1')
        .send({ current_password: 'wrong-password-1', new_password: NEW_PASSWORD })
        .expect(422);

      expect((res.body as { error: { details: unknown } }).error.details).toEqual({
        field: 'currentPassword',
      });
    });
  });
});
