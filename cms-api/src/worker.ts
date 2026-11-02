import { createEmailSender, createInfrastructure } from './composition/infrastructure.js';
import { createMaintenanceJobs } from './composition/maintenance-jobs.js';
import { loadEnv } from './config/env.schema.js';
import { startEmailWorker } from './shared/adapters/out/bullmq-email-queue.js';
import { startMaintenance } from './shared/adapters/out/bullmq-maintenance.js';

const config = loadEnv(process.env);
const running = createInfrastructure(config, 'cms-worker');
const { logger } = running.infrastructure;
const emailWorker = startEmailWorker(config.redisUrl, createEmailSender(config, logger), logger);
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
