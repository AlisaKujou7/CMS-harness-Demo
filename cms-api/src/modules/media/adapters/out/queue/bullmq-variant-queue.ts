import { Queue } from 'bullmq';
import { withTimeout } from '../../../../../shared/adapters/out/with-timeout.js';
import type { MediaVariantQueue } from '../../../application/ports/out/media-services.port.js';

const JOB_NAME = 'generate';
const ENQUEUE_TIMEOUT_MS = 2000;
const ATTEMPTS = 3;
const BACKOFF_MS = 10_000;

export class BullMqVariantQueue implements MediaVariantQueue {
  private readonly queue: Queue<{ mediaId: string }>;

  constructor(redisUrl: string, queueName: string) {
    this.queue = new Queue(queueName, { connection: { url: redisUrl, maxRetriesPerRequest: 1 } });
  }

  onConnectionError(handler: (error: Error) => void): void {
    this.queue.on('error', handler);
  }

  // One job per media at a time: the id makes a repeat request a no-op while one is waiting.
  async enqueue(mediaId: string): Promise<void> {
    await withTimeout(
      this.queue.add(
        JOB_NAME,
        { mediaId },
        {
          jobId: mediaId,
          attempts: ATTEMPTS,
          backoff: { type: 'fixed', delay: BACKOFF_MS },
          removeOnComplete: true,
          removeOnFail: true,
        },
      ),
      ENQUEUE_TIMEOUT_MS,
      'Timed out enqueueing media variants',
    );
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}
