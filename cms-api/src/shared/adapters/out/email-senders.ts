import type { EmailMessage, EmailSender, Logger } from '../../ports/system.port.js';

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
