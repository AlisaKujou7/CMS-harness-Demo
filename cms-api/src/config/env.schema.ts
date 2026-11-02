import { z } from 'zod';

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
const MAX_ACCESS_TTL_MS = 60 * 60_000;
const MAX_REFRESH_TTL_MS = 14 * 86_400_000;
const MIN_SECRET_LENGTH = 64;

export function parseDurationMs(input: string): number | null {
  const match = /^(\d+)([smhd])$/.exec(input);
  return match ? Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS] : null;
}

const blankToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalString = z.preprocess(blankToUndefined, z.string().optional());
const count = (fallback: number) => z.coerce.number().int().positive().default(fallback);

function duration(maxMs: number, label: string) {
  return z.string().transform((value, context) => {
    const ms = parseDurationMs(value);
    if (ms !== null && ms > 0 && ms <= maxMs) return ms;
    context.addIssue({
      code: 'custom',
      message: `must be a duration such as 15m, at most ${label}`,
    });
    return z.NEVER;
  });
}

const secret = z
  .string()
  .min(MIN_SECRET_LENGTH, { error: `must be at least ${String(MIN_SECRET_LENGTH)} characters` })
  .refine((value) => !value.includes('CHANGE_ME'), { error: 'is still the placeholder' });

const schema = z
  .object({
    NODE_ENV: z.enum(['production', 'staging', 'development']),
    HTTP_PORT: count(3000),
    PUBLIC_URL: z.url(),
    TRUST_PROXY: z.enum(['true', 'false']).default('false'),
    CORS_ALLOWED_ORIGINS: z.string(),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    JWT_SECRET: secret,
    JWT_SECRET_PREVIOUS: z.preprocess(blankToUndefined, secret.optional()),
    JWT_ACCESS_TTL: duration(MAX_ACCESS_TTL_MS, '60m').prefault('15m'),
    JWT_REFRESH_TTL: duration(MAX_REFRESH_TTL_MS, '14d').prefault('14d'),
    ARGON2_MEMORY_KB: count(19_456),
    ARGON2_ITERATIONS: count(2),
    ARGON2_PARALLELISM: count(1),
    RATE_LIMIT_LOGIN_PER_MIN: count(10),
    RATE_LIMIT_PASSWORD_RESET_PER_HOUR: count(5),
    RATE_LIMIT_INVITATION_PER_HOUR: count(30),
    EMAIL_PROVIDER: z.enum(['console', 'smtp', 'ses']),
    EMAIL_FROM: z.string().default('no-reply@example.com'),
    EMAIL_FROM_NAME: z.string().default('CMS'),
    SMTP_HOST: optionalString,
    SMTP_PORT: count(587),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    SMTP_SECURE: z.preprocess(blankToUndefined, z.enum(['true', 'false']).default('true')),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  })
  .superRefine((env, context) => {
    if (env.EMAIL_PROVIDER === 'console') {
      if (env.NODE_ENV === 'production') {
        context.addIssue({
          code: 'custom',
          path: ['EMAIL_PROVIDER'],
          message: 'console is not allowed in production',
        });
      }
      return;
    }
    if (env.SMTP_HOST === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'is required for this email provider',
      });
    }
  });

function toSecretList(current: string, previous: string | undefined): [string, ...string[]] {
  return previous === undefined ? [current] : [current, previous];
}

function toConfig(env: z.output<typeof schema>) {
  return {
    nodeEnv: env.NODE_ENV,
    httpPort: env.HTTP_PORT,
    trustProxy: env.TRUST_PROXY === 'true',
    publicUrl: env.PUBLIC_URL.replace(/\/$/, ''),
    corsOrigins: env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    jwtSecrets: toSecretList(env.JWT_SECRET, env.JWT_SECRET_PREVIOUS),
    accessTokenTtlSeconds: env.JWT_ACCESS_TTL / 1000,
    refreshTokenTtlMs: env.JWT_REFRESH_TTL,
    argon2: {
      memoryKb: env.ARGON2_MEMORY_KB,
      iterations: env.ARGON2_ITERATIONS,
      parallelism: env.ARGON2_PARALLELISM,
    },
    rateLimitLoginPerMinute: env.RATE_LIMIT_LOGIN_PER_MIN,
    rateLimitPasswordResetPerHour: env.RATE_LIMIT_PASSWORD_RESET_PER_HOUR,
    rateLimitInvitationPerHour: env.RATE_LIMIT_INVITATION_PER_HOUR,
    email: {
      provider: env.EMAIL_PROVIDER,
      from: { address: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
      smtp: {
        host: env.SMTP_HOST ?? '',
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE === 'true',
        user: env.SMTP_USER ?? '',
        password: env.SMTP_PASSWORD ?? '',
      },
    },
    logLevel: env.LOG_LEVEL,
    secureCookies: env.NODE_ENV !== 'development',
  };
}

export type AppConfig = ReturnType<typeof toConfig>;

// Runs before anything else starts, so a misconfigured container fails loudly (07-OPS-ARCH 7.3).
// The message names variables and rules only, never values.
export function loadEnv(source: Readonly<Record<string, string | undefined>>): AppConfig {
  const result = schema.safeParse(source);
  if (result.success) return toConfig(result.data);

  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment:\n${problems.join('\n')}`);
}
