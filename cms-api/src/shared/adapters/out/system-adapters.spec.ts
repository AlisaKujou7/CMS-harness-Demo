import { Writable } from 'node:stream';
import nodemailer from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { InMemoryLogger } from '../../../../test/fakes/system.fakes.js';
import { ConsoleEmailSender, SmtpEmailSender, toSmtpOptions } from './email-senders.js';
import { createPinoLogger } from './pino-logger.js';
import { CompositeReadinessProbe } from './readiness-probe.js';
import { SystemClock, Uuidv4Generator } from './system.js';

function captureLogs() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  return { lines, stream };
}

describe('SystemClock', () => {
  it('returns the current time', () => {
    const before = Date.now();

    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('Uuidv4Generator', () => {
  it('generates distinct version 4 UUIDs', () => {
    const generator = new Uuidv4Generator();

    expect(generator.next()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(generator.next()).not.toBe(generator.next());
  });
});

describe('createPinoLogger', () => {
  it('writes structured JSON with the level and context (NFR-OBS-01)', () => {
    const { lines, stream } = captureLogs();

    createPinoLogger({ level: 'info', service: 'cms-api' }, stream).info('started', { port: 3000 });

    expect(lines[0]).toMatchObject({
      level: 'info',
      service: 'cms-api',
      msg: 'started',
      port: 3000,
    });
  });

  it('writes errors', () => {
    const { lines, stream } = captureLogs();

    createPinoLogger({ level: 'info', service: 'x' }, stream).error('failed', { requestId: 'r1' });

    expect(lines[0]).toMatchObject({ level: 'error', msg: 'failed', requestId: 'r1' });
  });

  it('accepts a message with no context', () => {
    const { lines, stream } = captureLogs();

    createPinoLogger({ level: 'info', service: 'x' }, stream).info('plain');

    expect(lines[0]).toMatchObject({ msg: 'plain' });
  });

  it.each([
    'password',
    'passwordHash',
    'password_hash',
    'token',
    'access_token',
    'refresh_token',
    'refreshToken',
    'accessToken',
    'jwt',
    'authorization',
    'x-api-key',
    'email',
    'ip',
  ])('redacts %s (07-OPS-ARCH 14.6, SEC-14)', (field) => {
    const { lines, stream } = captureLogs();

    createPinoLogger({ level: 'info', service: 'x' }, stream).info('event', { [field]: 'secret' });

    expect(JSON.stringify(lines[0])).not.toContain('secret');
  });

  it('respects the configured level', () => {
    const { lines, stream } = captureLogs();

    createPinoLogger({ level: 'error', service: 'x' }, stream).info('hidden');

    expect(lines).toEqual([]);
  });
});

describe('SmtpEmailSender', () => {
  it('sends through the transport with the configured sender', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const sent: unknown[] = [];
    const sendMail = transport.sendMail.bind(transport);
    const recording = {
      sendMail: async (message: Parameters<typeof sendMail>[0]) => {
        sent.push(message);
        return sendMail(message);
      },
    };

    await new SmtpEmailSender(recording, { address: 'no-reply@example.com', name: 'CMS' }).send({
      to: 'a@example.com',
      subject: 'Hi',
      text: 'Body',
    });

    expect(sent).toEqual([
      {
        from: { address: 'no-reply@example.com', name: 'CMS' },
        to: 'a@example.com',
        subject: 'Hi',
        text: 'Body',
      },
    ]);
  });

  it('lets a delivery failure reach the caller', async () => {
    const failing = { sendMail: () => Promise.reject(new Error('smtp down')) };

    await expect(
      new SmtpEmailSender(failing, { address: 'x@example.com', name: 'CMS' }).send({
        to: 'a@example.com',
        subject: 'Hi',
        text: 'Body',
      }),
    ).rejects.toThrow('smtp down');
  });
});

describe('toSmtpOptions', () => {
  const smtp = { host: 'mail', port: 587, secure: true, user: 'u', password: 'p' };

  it('upgrades with STARTTLS on port 587 and refuses to send in clear text', () => {
    expect(toSmtpOptions(smtp)).toEqual({
      host: 'mail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'u', pass: 'p' },
    });
  });

  it('uses implicit TLS on port 465', () => {
    expect(toSmtpOptions({ ...smtp, port: 465 })).toMatchObject({
      secure: true,
      requireTLS: false,
    });
  });

  it('allows plain SMTP only when secure is off', () => {
    expect(toSmtpOptions({ ...smtp, secure: false })).toMatchObject({
      secure: false,
      requireTLS: false,
    });
  });

  it('omits authentication when no user is configured', () => {
    expect(toSmtpOptions({ ...smtp, user: '', password: '' })).not.toHaveProperty('auth');
  });
});

describe('ConsoleEmailSender', () => {
  it('logs the message so a developer can follow the link', async () => {
    const logger = new InMemoryLogger();

    await new ConsoleEmailSender(logger).send({ to: 'a@example.com', subject: 'Hi', text: 'Link' });

    expect(logger.infos).toEqual([
      {
        message: 'Email (development only)',
        context: { recipient: 'a@example.com', subject: 'Hi', text: 'Link' },
      },
    ]);
  });
});

describe('CompositeReadinessProbe', () => {
  it('is ready when every check passes', async () => {
    const probe = new CompositeReadinessProbe([() => Promise.resolve(), () => Promise.resolve()]);

    await expect(probe.check()).resolves.toBe(true);
  });

  it('is not ready when any check fails', async () => {
    const probe = new CompositeReadinessProbe([
      () => Promise.resolve(),
      () => Promise.reject(new Error('down')),
    ]);

    await expect(probe.check()).resolves.toBe(false);
  });
});
