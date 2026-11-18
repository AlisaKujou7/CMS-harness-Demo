import type { EmailMessage, EmailSender, Logger } from '../../ports/system.port.js';

const IMPLICIT_TLS_PORT = 465;

export interface SmtpSettings {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly password: string;
}

// "secure" means the mail must be encrypted. Nodemailer's own `secure` flag means implicit TLS,
// which fails on port 587 where the connection starts in plain text and upgrades with STARTTLS.
export function toSmtpOptions(smtp: SmtpSettings) {
  const implicitTls = smtp.port === IMPLICIT_TLS_PORT;
  return {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure && implicitTls,
    requireTLS: smtp.secure && !implicitTls,
    ...(smtp.user === '' ? {} : { auth: { user: smtp.user, pass: smtp.password } }),
  };
}

export interface MailTransport {
  sendMail(message: {
    from: { address: string; name: string };
    to: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
}

export class SmtpEmailSender implements EmailSender {
  constructor(
    private readonly transport: MailTransport,
    private readonly from: { address: string; name: string },
  ) {}

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({ ...message, from: this.from });
  }
}

export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly logger: Logger) {}

  send(message: EmailMessage): Promise<void> {
    this.logger.info('Email (development only)', {
      recipient: message.to,
      subject: message.subject,
      text: message.text,
    });
    return Promise.resolve();
  }
}
