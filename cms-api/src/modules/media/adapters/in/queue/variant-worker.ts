import { Worker } from 'bullmq';
import type { Logger } from '../../../../../shared/ports/system.port.js';
import type { GenerateMediaVariantsUseCase } from '../../../application/ports/in/media.ports.js';

// Resizing is memory-heavy, so only a couple run at once.
const CONCURRENCY = 2;

export function startVariantWorker(
  redisUrl: string,
  queueName: string,
  useCase: GenerateMediaVariantsUseCase,
  logger: Logger,
): Worker<{ mediaId: string }> {
  const worker = new Worker<{ mediaId: string }>(
    queueName,
    (job) => useCase.execute(job.data.mediaId),
    { connection: { url: redisUrl, maxRetriesPerRequest: null }, concurrency: CONCURRENCY },
  );
  worker.on('failed', (job, error) => {
    logger.error('Media variant job failed', { mediaId: job?.data.mediaId, error: error.message });
  });
  worker.on('error', (error) => {
    logger.error('Media variant worker connection error', { error: error.message });
  });
  return worker;
}
