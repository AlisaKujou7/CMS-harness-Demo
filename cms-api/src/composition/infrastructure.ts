import { Redis } from 'ioredis';
import nodemailer from 'nodemailer';
import type { AppConfig } from '../config/env.schema.js';
import { PrismaAuditEventReader } from '../modules/audit/adapters/out/persistence/prisma-audit-event-reader.js';
import { PrismaAuditLog } from '../modules/audit/adapters/out/persistence/prisma-audit-log.js';
import { PrismaInvitationTokenRepository } from '../modules/auth/adapters/out/persistence/prisma-invitation-token.repository.js';
import { PrismaContentRepository } from '../modules/content/adapters/out/persistence/prisma-content.repository.js';
import { PrismaUserRepository } from '../modules/users/adapters/out/persistence/prisma-user.repository.js';
import { InProcessEventPublisher } from '../shared/adapters/out/in-process-event-publisher.js';
import { Argon2PasswordHasher } from '../modules/auth/adapters/out/crypto/argon2-password-hasher.js';
import { JoseAccessTokenSigner } from '../modules/auth/adapters/out/crypto/jose-access-token-signer.js';
import { Sha256OpaqueTokenService } from '../modules/auth/adapters/out/crypto/sha256-opaque-token-service.js';
import { PrismaAccountRepository } from '../modules/auth/adapters/out/persistence/prisma-account.repository.js';
import { PrismaApiKeyRepository } from '../modules/auth/adapters/out/persistence/prisma-api-key.repository.js';
import { PrismaLoginLockoutRepository } from '../modules/auth/adapters/out/persistence/prisma-login-lockout.repository.js';
import { PrismaPasswordResetTokenRepository } from '../modules/auth/adapters/out/persistence/prisma-password-reset-token.repository.js';
import { PrismaRefreshTokenRepository } from '../modules/auth/adapters/out/persistence/prisma-refresh-token.repository.js';
import type { HttpConfig } from '../shared/adapters/http/tokens.js';
import { BullMqEmailQueue } from '../shared/adapters/out/bullmq-email-queue.js';
import {
  ConsoleEmailSender,
  SmtpEmailSender,
  toSmtpOptions,
} from '../shared/adapters/out/email-senders.js';
import { createPinoLogger } from '../shared/adapters/out/pino-logger.js';
import { PrismaContext } from '../shared/adapters/out/prisma-context.js';
import { CompositeReadinessProbe } from '../shared/adapters/out/readiness-probe.js';
import { RedisRateLimiter } from '../shared/adapters/out/redis-rate-limiter.js';
import { SystemClock, Uuidv4Generator } from '../shared/adapters/out/system.js';
import type { EmailSender, Logger } from '../shared/ports/system.port.js';
import type { Infrastructure } from './app.module.js';

const EMAIL_DELIVERY = { attempts: 5, backoffMs: 30_000 };

export function createEmailSender(config: AppConfig, logger: Logger): EmailSender {
  const { provider, from, smtp } = config.email;
  if (provider === 'console') return new ConsoleEmailSender(logger);
  return new SmtpEmailSender(nodemailer.createTransport(toSmtpOptions(smtp)), from);
}

function toHttpConfig(config: AppConfig): HttpConfig {
  return {
    secureCookies: config.secureCookies,
    trustProxy: config.trustProxy,
    corsOrigins: config.corsOrigins,
    rateLimits: {
      login: { limit: config.rateLimitLoginPerMinute, windowSeconds: 60 },
      passwordReset: { limit: config.rateLimitPasswordResetPerHour, windowSeconds: 3600 },
      invitation: { limit: config.rateLimitInvitationPerHour, windowSeconds: 3600 },
    },
  };
}

function createEmailQueue(config: AppConfig, logger: Logger): BullMqEmailQueue {
  const queue = new BullMqEmailQueue(config.redisUrl, EMAIL_DELIVERY);
  queue.onConnectionError((error) => {
    logger.error('Email queue connection error', { error: error.message });
  });
  return queue;
}

function createRepositories(db: PrismaContext) {
  return {
    accounts: new PrismaAccountRepository(db),
    lockouts: new PrismaLoginLockoutRepository(db),
    refreshTokens: new PrismaRefreshTokenRepository(db),
    resetTokens: new PrismaPasswordResetTokenRepository(db),
    invitationTokens: new PrismaInvitationTokenRepository(db),
    apiKeys: new PrismaApiKeyRepository(db),
    users: new PrismaUserRepository(db),
    contents: new PrismaContentRepository(db),
    auditReader: new PrismaAuditEventReader(db),
  };
}

export interface RunningInfrastructure {
  readonly infrastructure: Infrastructure;
  readonly db: PrismaContext;
  readonly dispose: () => Promise<void>;
}

export function createInfrastructure(
  config: AppConfig,
  service = 'cms-api',
): RunningInfrastructure {
  const logger = createPinoLogger({ level: config.logLevel, service });
  const db = new PrismaContext(config.databaseUrl);
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 1 });
  redis.on('error', (error: Error) => {
    logger.error('Redis connection error', { error: error.message });
  });
  const emailQueue = createEmailQueue(config, logger);
  const clock = new SystemClock();
  const ids = new Uuidv4Generator();

  const infrastructure: Infrastructure = {
    ...createRepositories(db),
    contentCategories: config.contentCategories,
    events: new InProcessEventPublisher(logger),
    hasher: new Argon2PasswordHasher(config.argon2),
    signer: new JoseAccessTokenSigner(config.jwtSecrets, clock),
    opaqueTokens: new Sha256OpaqueTokenService(),
    clock,
    ids,
    tx: db,
    audit: new PrismaAuditLog(db, clock, ids),
    email: emailQueue,
    logger,
    config: {
      accessTokenTtlSeconds: config.accessTokenTtlSeconds,
      refreshTokenTtlMs: config.refreshTokenTtlMs,
      publicUrl: config.publicUrl,
    },
    rateLimiter: new RedisRateLimiter(redis, logger),
    readiness: new CompositeReadinessProbe([() => db.ping(), () => redis.ping()]),
    http: toHttpConfig(config),
  };

  return {
    infrastructure,
    db,
    dispose: async () => {
      redis.disconnect();
      await emailQueue.close();
      await db.disconnect();
    },
  };
}
