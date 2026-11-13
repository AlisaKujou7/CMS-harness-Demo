import nodemailer from 'nodemailer';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SmtpEmailSender, toSmtpOptions } from '../../../src/shared/adapters/out/email-senders.js';

const SMTP_PORT = 1025;
const API_PORT = 8025;
const from = { address: 'no-reply@example.com', name: 'CMS' };
const message = { to: 'user@example.com', subject: 'Hello', text: 'Real delivery' };

// A real SMTP server that insists on STARTTLS, as port 587 does at most providers.
describe('SMTP delivery against a real server', () => {
  let server: StartedTestContainer;
  let smtp: { host: string; port: number; secure: boolean; user: string; password: string };
  // The test server uses a self-signed certificate.
  const selfSigned = { tls: { rejectUnauthorized: false } };

  beforeAll(async () => {
    server = await new GenericContainer('axllent/mailpit:v1.27')
      .withEnvironment({ MP_SMTP_TLS_CERT: 'sans:localhost', MP_SMTP_TLS_KEY: 'sans:localhost' })
      .withEnvironment({ MP_SMTP_REQUIRE_STARTTLS: 'true' })
      .withExposedPorts(SMTP_PORT, API_PORT)
      .withWaitStrategy(Wait.forListeningPorts())
      .start();
    smtp = {
      host: server.getHost(),
      port: server.getMappedPort(SMTP_PORT),
      secure: true,
      user: '',
      password: '',
    };
  });

  afterAll(async () => {
    await server.stop();
  });

  it('delivers using the options built for a STARTTLS port', async () => {
    const transport = nodemailer.createTransport({ ...toSmtpOptions(smtp), ...selfSigned });

    await new SmtpEmailSender(transport, from).send(message);

    const api = `http://${server.getHost()}:${String(server.getMappedPort(API_PORT))}/api/v1/messages`;
    const { messages } = (await (await fetch(api)).json()) as {
      messages: { Subject: string; To: { Address: string }[] }[];
    };
    expect(messages[0]?.Subject).toBe('Hello');
    expect(messages[0]?.To[0]?.Address).toBe('user@example.com');
  });

  it('fails with implicit TLS on that port, which is the bug these options prevent', async () => {
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: true,
      connectionTimeout: 5_000,
      ...selfSigned,
    });

    await expect(new SmtpEmailSender(transport, from).send(message)).rejects.toThrow();
  });

  it('refuses to send in clear text to a server that cannot upgrade', async () => {
    const plain = await new GenericContainer('axllent/mailpit:v1.27')
      .withExposedPorts(SMTP_PORT)
      .withWaitStrategy(Wait.forListeningPorts())
      .start();
    const options = toSmtpOptions({
      ...smtp,
      host: plain.getHost(),
      port: plain.getMappedPort(SMTP_PORT),
    });

    await expect(
      new SmtpEmailSender(nodemailer.createTransport(options), from).send(message),
    ).rejects.toThrow(/STARTTLS/);

    await plain.stop();
  });
});
