import {
  createEmailSender,
  createInfrastructure,
  VARIANT_QUEUE,
} from './composition/infrastructure.js';
import { mediaDeps, wirePublicCacheInvalidation } from './composition/module-deps.js';
import { createMaintenanceJobs } from './composition/maintenance-jobs.js';
import { loadEnv } from './config/env.schema.js';
import { startVariantWorker } from './modules/media/adapters/in/queue/variant-worker.js';
import { GenerateMediaVariants } from './modules/media/application/use-cases/media-background.use-case.js';
import { startEmailWorker } from './shared/adapters/out/bullmq-email-queue.js';
import { startMaintenance } from './shared/adapters/out/bullmq-maintenance.js';

const config = loadEnv(process.env);
const running = createInfrastructure(config, 'cms-worker');
const { logger } = running.infrastructure;
wirePublicCacheInvalidation(running.infrastructure);
const emailWorker = startEmailWorker(config.redisUrl, createEmailSender(config, logger), logger);
const variantWorker = startVariantWorker(
  config.redisUrl,
  VARIANT_QUEUE,
  new GenerateMediaVariants(mediaDeps(running.infrastructure)),
  logger,
);
const maintenance = await startMaintenance(
  config.redisUrl,
  createMaintenanceJobs(running.infrastructure, config.scheduledPublishIntervalMs),
  logger,
);
logger.info('Worker started');

async function shutdown(signal: string): Promise<void> {
  try {
    logger.info('Shutting down', { signal });
    await maintenance.close();
    await variantWorker.close();
    await emailWorker.close();
    await running.dispose();
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown failed', { error: String(error) });
    process.exit(1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
