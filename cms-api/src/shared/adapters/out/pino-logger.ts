import { pino } from 'pino';
import type { LogContext, Logger } from '../../ports/system.port.js';

const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'jwt',
  'authorization',
  '["x-api-key"]',
  'email',
  'ip',
];

export interface LoggerOptions {
  readonly level: string;
  readonly service: string;
}

// Structured JSON on stdout (07-OPS-ARCH 14). Secrets and PII are redacted by field name.
export function createPinoLogger(
  options: LoggerOptions,
  destination: { write(line: string): void } = process.stdout,
): Logger {
  const logger = pino(
    {
      level: options.level,
      base: { service: options.service },
      formatters: { level: (label) => ({ level: label }) },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: [
          ...SENSITIVE_FIELDS,
          ...SENSITIVE_FIELDS.map((field) => (field.startsWith('[') ? `*${field}` : `*.${field}`)),
        ],
        censor: '[REDACTED]',
      },
    },
    destination,
  );
  return {
    info: (message: string, context: LogContext = {}) => {
      logger.info(context, message);
    },
    error: (message: string, context: LogContext = {}) => {
      logger.error(context, message);
    },
  };
}
