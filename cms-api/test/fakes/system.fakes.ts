import type { Actor } from '../../src/shared/kernel/actor.js';
import { UnauthenticatedError } from '../../src/shared/kernel/app-error.js';
import type { AccessTokenAuthenticator } from '../../src/shared/ports/access-token-authenticator.port.js';
import type {
  AuditEventInput,
  AuditLog,
  Clock,
  EmailMessage,
  EmailSender,
  IdGenerator,
  LogContext,
  Logger,
  RateLimitDecision,
  RateLimiter,
  ReadinessProbe,
  TransactionRunner,
} from '../../src/shared/ports/system.port.js';

export class FakeAccessTokenAuthenticator implements AccessTokenAuthenticator {
  private readonly actors = new Map<string, Actor>();

  allow(token: string, actor: Actor): void {
    this.actors.set(token, actor);
  }

  authenticate(token: string): Promise<Actor> {
    const actor = this.actors.get(token);
    return actor ? Promise.resolve(actor) : Promise.reject(new UnauthenticatedError());
  }
}

export class FakeClock implements Clock {
  private current: Date;

  constructor(iso = '2026-05-11T10:00:00Z') {
    this.current = new Date(iso);
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  advanceMinutes(minutes: number): void {
    this.advanceMs(minutes * 60_000);
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}

export class FakeTransactionRunner implements TransactionRunner {
  runs = 0;

  run<T>(work: () => Promise<T>): Promise<T> {
    this.runs += 1;
    return work();
  }
}

export class InMemoryAuditLog implements AuditLog {
  readonly events: AuditEventInput[] = [];

  record(event: AuditEventInput): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  actions(): string[] {
    return this.events.map((event) => event.action);
  }
}

export class InMemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  failWith: Error | null = null;

  send(message: EmailMessage): Promise<void> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.sent.push(message);
    return Promise.resolve();
  }
}

export class InMemoryLogger implements Logger {
  readonly errors: { message: string; context: LogContext | undefined }[] = [];
  readonly infos: { message: string; context: LogContext | undefined }[] = [];

  info(message: string, context?: LogContext): void {
    this.infos.push({ message, context });
  }

  error(message: string, context?: LogContext): void {
    this.errors.push({ message, context });
  }
}

export class FakeReadinessProbe implements ReadinessProbe {
  ready = true;

  check(): Promise<boolean> {
    return Promise.resolve(this.ready);
  }
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly counts = new Map<string, number>();

  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return Promise.resolve({
      allowed: count <= limit,
      retryAfterSeconds: count <= limit ? 0 : windowSeconds,
    });
  }
}
