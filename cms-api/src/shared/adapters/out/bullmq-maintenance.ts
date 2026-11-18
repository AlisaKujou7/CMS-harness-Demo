import { Queue, Worker } from 'bullmq';
import type { Logger } from '../../ports/system.port.js';

const DEFAULT_QUEUE_NAME = 'maintenance';

export interface MaintenanceJob {
  readonly name: string;
  readonly everyMs: number;
  run(): Promise<unknown>;
}

export interface MaintenanceRunner {
  close(): Promise<void>;
}

// Job schedulers live in Redis under their names, so running several workers or restarting one
// never multiplies the schedule. A failed run is logged, and the next tick is its retry.
export async function startMaintenance(
  redisUrl: string,
  jobs: readonly MaintenanceJob[],
  logger: Logger,
  queueName: string = DEFAULT_QUEUE_NAME,
): Promise<MaintenanceRunner> {
  const connection = { url: redisUrl, maxRetriesPerRequest: null };
  const handlers = new Map(jobs.map((job) => [job.name, job]));

  const queue = new Queue(queueName, { connection });
  queue.on('error', (error) => {
    logger.error('Maintenance queue connection error', { error: error.message });
  });
  for (const job of jobs) {
    await queue.upsertJobScheduler(
      job.name,
      { every: job.everyMs },
      { name: job.name, opts: { removeOnComplete: true, removeOnFail: true } },
    );
  }

  const worker = new Worker(
    queueName,
    async (job) => {
      await handlers.get(job.name)?.run();
    },
    { connection },
  );
  worker.on('failed', (job, error) => {
    logger.error('Maintenance job failed', { job: job?.name, error: error.message });
  });
  worker.on('error', (error) => {
    logger.error('Maintenance worker connection error', { error: error.message });
  });

  return {
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}
