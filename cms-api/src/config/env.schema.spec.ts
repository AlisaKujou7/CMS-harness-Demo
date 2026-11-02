import { describe, expect, it } from 'vitest';
import { loadEnv, parseDurationMs } from './env.schema.js';

const VALID = {
  NODE_ENV: 'production',
  HTTP_PORT: '3000',
  PUBLIC_URL: 'https://cms.example.com',
  CORS_ALLOWED_ORIGINS: 'https://cms.example.com, https://www.example.com',
  DATABASE_URL: 'postgresql://u:p@db:5432/cms',
  REDIS_URL: 'redis://default:p@redis:6379',
  JWT_SECRET: 'a'.repeat(64),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '14d',
  EMAIL_PROVIDER: 'ses',
  EMAIL_FROM: 'no-reply@example.com',
  EMAIL_FROM_NAME: 'CMS',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'user',
  SMTP_PASSWORD: 'pass',
};

describe('parseDurationMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['14d', 1_209_600_000],
  ])('parses %s', (input, expected) => {
    expect(parseDurationMs(input)).toBe(expected);
  });

  it.each(['15', 'm', '1w', '-1m', '', '1.5h'])('rejects "%s"', (input) => {
    expect(parseDurationMs(input)).toBeNull();
  });
});

describe('media settings', () => {
  const minimal = {
    NODE_ENV: 'development',
    PUBLIC_URL: 'http://localhost:3000',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
    DATABASE_URL: 'postgres://x',
    REDIS_URL: 'redis://x',
    JWT_SECRET: 'a'.repeat(64),
    EMAIL_PROVIDER: 'console',
  };

  it('defaults to S3 with an ambient identity, and a 20 MB limit (FR-MEDIA-02)', () => {
    expect(loadEnv(minimal)).toMatchObject({
      objectStorage: { bucket: 'cms-media', region: 'us-east-1', forcePathStyle: false },
      media: {
        maxUploadBytes: 20 * 1024 * 1024,
        uploadUrlTtlSeconds: 900,
        readUrlTtlSeconds: 3600,
      },
    });
  });

  it('reads a MinIO setup, and a changed limit', () => {
    const config = loadEnv({
      ...minimal,
      OBJECT_STORAGE_PROVIDER: 'minio',
      OBJECT_STORAGE_ENDPOINT: 'http://minio:9000',
      OBJECT_STORAGE_ACCESS_KEY: 'a',
      OBJECT_STORAGE_SECRET_KEY: 'b',
      OBJECT_STORAGE_PUBLIC_URL: 'https://media.example.com',
      MEDIA_MAX_UPLOAD_MB: '5',
    });

    expect(config.objectStorage).toEqual({
      bucket: 'cms-media',
      region: 'us-east-1',
      forcePathStyle: true,
      endpoint: 'http://minio:9000',
      publicUrl: 'https://media.example.com',
      accessKey: 'a',
      secretKey: 'b',
    });
    expect(config.media.maxUploadBytes).toBe(5 * 1024 * 1024);
  });

  it.each(['OBJECT_STORAGE_ENDPOINT', 'OBJECT_STORAGE_ACCESS_KEY', 'OBJECT_STORAGE_SECRET_KEY'])(
    'requires %s for MinIO',
    (missing) => {
      const env = {
        ...minimal,
        OBJECT_STORAGE_PROVIDER: 'minio',
        OBJECT_STORAGE_ENDPOINT: 'http://minio:9000',
        OBJECT_STORAGE_ACCESS_KEY: 'a',
        OBJECT_STORAGE_SECRET_KEY: 'b',
        [missing]: '',
      };

      expect(() => loadEnv(env)).toThrow(missing);
    },
  );
});

describe('content settings', () => {
  const minimal = {
    NODE_ENV: 'development',
    PUBLIC_URL: 'http://localhost:3000',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
    DATABASE_URL: 'postgres://x',
    REDIS_URL: 'redis://x',
    JWT_SECRET: 'a'.repeat(64),
    EMAIL_PROVIDER: 'console',
  };

  it('defaults the category list and publish interval', () => {
    expect(loadEnv(minimal)).toMatchObject({
      contentCategories: ['news', 'guides', 'announcements'],
      scheduledPublishIntervalMs: 30_000,
    });
  });

  it('reads them, tidying the list', () => {
    const config = loadEnv({
      ...minimal,
      CONTENT_CATEGORIES: ' a, b ,,c',
      WORKER_SCHEDULED_PUBLISH_INTERVAL_SEC: '5',
    });

    expect(config.contentCategories).toEqual(['a', 'b', 'c']);
    expect(config.scheduledPublishIntervalMs).toBe(5000);
  });
});

describe('loadEnv', () => {
  it('parses a complete configuration and applies defaults', () => {
    const env = loadEnv(VALID);

    expect(env).toMatchObject({
      nodeEnv: 'production',
      httpPort: 3000,
      publicUrl: 'https://cms.example.com',
      corsOrigins: ['https://cms.example.com', 'https://www.example.com'],
      accessTokenTtlSeconds: 900,
      refreshTokenTtlMs: 1_209_600_000,
      jwtSecrets: ['a'.repeat(64)],
      rateLimitLoginPerMinute: 10,
      rateLimitPasswordResetPerHour: 5,
      rateLimitInvitationPerHour: 30,
      argon2: { memoryKb: 19_456, iterations: 2, parallelism: 1 },
      logLevel: 'info',
      secureCookies: true,
    });
  });

  it('defaults the token lifetimes to 15 minutes and 14 days', () => {
    const env = loadEnv({ ...VALID, JWT_ACCESS_TTL: undefined, JWT_REFRESH_TTL: undefined });

    expect(env.accessTokenTtlSeconds).toBe(900);
    expect(env.refreshTokenTtlMs).toBe(1_209_600_000);
  });

  it('trusts a proxy only when told to', () => {
    expect(loadEnv(VALID).trustProxy).toBe(false);
    expect(loadEnv({ ...VALID, TRUST_PROXY: 'false' }).trustProxy).toBe(false);
    expect(loadEnv({ ...VALID, TRUST_PROXY: 'true' }).trustProxy).toBe(true);
  });

  it('removes a trailing slash from the public URL', () => {
    expect(loadEnv({ ...VALID, PUBLIC_URL: 'https://cms.example.com/' }).publicUrl).toBe(
      'https://cms.example.com',
    );
  });

  it('includes the previous JWT secret during rotation', () => {
    const env = loadEnv({ ...VALID, JWT_SECRET_PREVIOUS: 'b'.repeat(64) });

    expect(env.jwtSecrets).toEqual(['a'.repeat(64), 'b'.repeat(64)]);
  });

  it('treats a blank previous secret as absent', () => {
    expect(loadEnv({ ...VALID, JWT_SECRET_PREVIOUS: '' }).jwtSecrets).toHaveLength(1);
  });

  it('allows insecure cookies only in development', () => {
    const env = loadEnv({ ...VALID, NODE_ENV: 'development' });

    expect(env.secureCookies).toBe(false);
    expect(loadEnv({ ...VALID, NODE_ENV: 'staging' }).secureCookies).toBe(true);
  });

  it.each([
    ['a missing database URL', { DATABASE_URL: undefined }, 'DATABASE_URL'],
    ['a short JWT secret', { JWT_SECRET: 'short' }, 'JWT_SECRET'],
    [
      'a placeholder JWT secret',
      { JWT_SECRET: '__CHANGE_ME_64_CHAR_HEX__'.padEnd(64, '_') },
      'JWT_SECRET',
    ],
    ['a short previous secret', { JWT_SECRET_PREVIOUS: 'short' }, 'JWT_SECRET_PREVIOUS'],
    ['an unknown environment', { NODE_ENV: 'test' }, 'NODE_ENV'],
    ['a bad port', { HTTP_PORT: 'abc' }, 'HTTP_PORT'],
    ['an access TTL over 60 minutes (FR-AUTH-04)', { JWT_ACCESS_TTL: '61m' }, 'JWT_ACCESS_TTL'],
    ['a refresh TTL over 14 days (FR-AUTH-04)', { JWT_REFRESH_TTL: '15d' }, 'JWT_REFRESH_TTL'],
    ['an unparsable TTL', { JWT_ACCESS_TTL: 'soon' }, 'JWT_ACCESS_TTL'],
    ['a zero TTL', { JWT_ACCESS_TTL: '0m' }, 'JWT_ACCESS_TTL'],
    ['the console mailer in production', { EMAIL_PROVIDER: 'console' }, 'EMAIL_PROVIDER'],
    ['SMTP settings missing for SES', { SMTP_HOST: '' }, 'SMTP_HOST'],
  ])('fails on %s and names the variable', (_name, overrides, variable) => {
    expect(() => loadEnv({ ...VALID, ...overrides })).toThrow(variable);
  });

  it('accepts the limits at exactly 60 minutes and 14 days', () => {
    const env = loadEnv({ ...VALID, JWT_ACCESS_TTL: '60m', JWT_REFRESH_TTL: '14d' });

    expect(env.accessTokenTtlSeconds).toBe(3600);
  });

  it('allows the console mailer outside production', () => {
    const env = loadEnv({
      ...VALID,
      NODE_ENV: 'development',
      EMAIL_PROVIDER: 'console',
      SMTP_HOST: '',
    });

    expect(env.email.provider).toBe('console');
  });

  it('exposes the SMTP settings', () => {
    expect(loadEnv({ ...VALID, SMTP_PORT: '2525', SMTP_SECURE: 'false' }).email).toEqual({
      provider: 'ses',
      from: { address: 'no-reply@example.com', name: 'CMS' },
      smtp: {
        host: 'smtp.example.com',
        port: 2525,
        secure: false,
        user: 'user',
        password: 'pass',
      },
    });
  });

  it('never includes secret values in the error', () => {
    const attempt = () => loadEnv({ ...VALID, JWT_SECRET: 'super-secret-short' });

    expect(attempt).toThrow();
    expect(attempt).not.toThrow('super-secret-short');
  });
});
