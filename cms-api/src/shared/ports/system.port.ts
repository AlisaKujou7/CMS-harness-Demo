export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export type LogContext = Readonly<Record<string, unknown>>;

export interface Logger {
  info(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface AuditEventInput {
  readonly actorId: string | null;
  readonly actorIp: string | null;
  readonly action: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly summary: Readonly<Record<string, unknown>>;
}

// Append-only by construction: there is no update or delete (FR-AUDIT-03).
export interface AuditLog {
  record(event: AuditEventInput): Promise<void>;
}
