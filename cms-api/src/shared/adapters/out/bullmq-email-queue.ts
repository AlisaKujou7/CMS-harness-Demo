import { Queue, Worker } from 'bullmq';
import { withTimeout } from './with-timeout.js';
import type { EmailMessage, EmailSender, Logger } from '../../ports/system.port.js';

const DEFAULT_QUEUE_NAME = 'emails';
const JOB_NAME = 'send';
const ENQUEUE_TIMEOUT_MS = 2000;

export interface EmailQueueOptions {
  readonly attempts: number;
  readonly backoffMs: number;
  readonly queueName?: string;
}

// Requests only enqueue, so SMTP latency never becomes API latency and the time taken does not
// reveal whether an account exists. Jobs hold reset links, so they are removed once finished.
export class BullMqEmailQueue implements EmailSender {
  private readonly queue: Queue<EmailMessage>;

  constructor(
    redisUrl: string,
    private readonly options: EmailQueueOptions,
  ) {
    this.queue = new Queue<EmailMessage>(options.queueName ?? DEFAULT_QUEUE_NAME, {
      connection: { url: redisUrl, maxRetriesPerRequest: 1 },
    });
  }

  onConnectionError(handler: (error: Error) => void): void {
    this.queue.on('error', handler);
  }

  async send(message: EmailMessage): Promise<void> {
    await withTimeout(
      this.queue.add(JOB_NAME, message, {
        attempts: this.options.attempts,
        backoff: { type: 'fixed', delay: this.options.backoffMs },
        removeOnComplete: true,
        removeOnFail: true,
      }),
      ENQUEUE_TIMEOUT_MS,
      'Timed out enqueueing an email',
    );
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}

export function startEmailWorker(
  redisUrl: string,
  sender: EmailSender,
  logger: Logger,
  queueName: string = DEFAULT_QUEUE_NAME,
): Worker<EmailMessage> {
  const worker = new Worker<EmailMessage>(queueName, (job) => sender.send(job.data), {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
  });
  worker.on('failed', (job) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      logger.error('Email delivery gave up', { attempts: job.attemptsMade });
    }
  });
  worker.on('error', (error) => {
    logger.error('Email worker connection error', { error: error.message });
  });
  return worker;
}
