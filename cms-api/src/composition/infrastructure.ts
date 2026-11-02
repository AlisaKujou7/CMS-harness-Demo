import { Redis } from 'ioredis';
import nodemailer from 'nodemailer';
import type { AppConfig } from '../config/env.schema.js';
import { PrismaAuditLog } from '../modules/audit/adapters/out/persistence/prisma-audit-log.js';
import { Argon2PasswordHasher } from '../modules/auth/adapters/out/crypto/argon2-password-hasher.js';
import { JoseAccessTokenSigner } from '../modules/auth/adapters/out/crypto/jose-access-token-signer.js';
import { Sha256OpaqueTokenService } from '../modules/auth/adapters/out/crypto/sha256-opaque-token-service.js';
import { PrismaAccountRepository } from '../modules/auth/adapters/out/persistence/prisma-account.repository.js';
import { PrismaApiKeyRepository } from '../modules/auth/adapters/out/persistence/prisma-api-key.repository.js';
import { PrismaLoginLockoutRepository } from '../modules/auth/adapters/out/persistence/prisma-login-lockout.repository.js';
import { PrismaPasswordResetTokenRepository } from '../modules/auth/adapters/out/persistence/prisma-password-reset-token.repository.js';
import { PrismaRefreshTokenRepository } from '../modules/auth/adapters/out/persistence/prisma-refresh-token.repository.js';
import { ConsoleEmailSender, SmtpEmailSender } from '../shared/adapters/out/email-senders.js';
import { createPinoLogger } from '../shared/adapters/out/pino-logger.js';
import { PrismaContext } from '../shared/adapters/out/prisma-context.js';
import { CompositeReadinessProbe } from '../shared/adapters/out/readiness-probe.js';
import { RedisRateLimiter } from '../shared/adapters/out/redis-rate-limiter.js';
import { SystemClock, Uuidv4Generator } from '../shared/adapters/out/system.js';
import type { EmailSender, Logger } from '../shared/ports/system.port.js';
import type { Infrastructure } from './app.module.js';

function createEmailSender(config: AppConfig, logger: Logger): EmailSender {
  const { provider, from, smtp } = config.email;
  if (provider === 'console') return new ConsoleEmailSender(logger);
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.password },
  });
  return new SmtpEmailSender(transport, from);
}

export interface RunningInfrastructure {
  readonly infrastructure: Infrastructure;
  readonly db: PrismaContext;
  readonly dispose: () => Promise<void>;
}

export function createInfrastructure(config: AppConfig): RunningInfrastructure {
  const logger = createPinoLogger({ level: config.logLevel, service: 'cms-api' });
  const db = new PrismaContext(config.databaseUrl);
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 1 });
  redis.on('error', (error: Error) => {
    logger.error('Redis connection error', { error: error.message });
  });
  const clock = new SystemClock();
  const ids = new Uuidv4Generator();

  const infrastructure: Infrastructure = {
    accounts: new PrismaAccountRepository(db),
    lockouts: new PrismaLoginLockoutRepository(db),
    refreshTokens: new PrismaRefreshTokenRepository(db),
    resetTokens: new PrismaPasswordResetTokenRepository(db),
    apiKeys: new PrismaApiKeyRepository(db),
    hasher: new Argon2PasswordHasher(config.argon2),
    signer: new JoseAccessTokenSigner(config.jwtSecrets, clock),
    opaqueTokens: new Sha256OpaqueTokenService(),
    clock,
    ids,
    tx: db,
    audit: new PrismaAuditLog(db, clock, ids),
    email: createEmailSender(config, logger),
    logger,
    config: {
      accessTokenTtlSeconds: config.accessTokenTtlSeconds,
      refreshTokenTtlMs: config.refreshTokenTtlMs,
      publicUrl: config.publicUrl,
    },
    rateLimiter: new RedisRateLimiter(redis, logger),
    readiness: new CompositeReadinessProbe([() => db.ping(), () => redis.ping()]),
    http: {
      secureCookies: config.secureCookies,
      corsOrigins: config.corsOrigins,
      rateLimits: {
        login: { limit: config.rateLimitLoginPerMinute, windowSeconds: 60 },
        passwordReset: { limit: config.rateLimitPasswordResetPerHour, windowSeconds: 3600 },
      },
    },
  };

  return {
    infrastructure,
    db,
    dispose: async () => {
      redis.disconnect();
      await db.disconnect();
    },
  };
}
