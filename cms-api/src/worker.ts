import { createEmailSender } from './composition/infrastructure.js';
import { loadEnv } from './config/env.schema.js';
import { startEmailWorker } from './shared/adapters/out/bullmq-email-queue.js';
import { createPinoLogger } from './shared/adapters/out/pino-logger.js';

const config = loadEnv(process.env);
const logger = createPinoLogger({ level: config.logLevel, service: 'cms-worker' });
const worker = startEmailWorker(config.redisUrl, createEmailSender(config, logger), logger);
logger.info('Worker started');

async function shutdown(signal: string): Promise<void> {
  try {
    logger.info('Shutting down', { signal });
    await worker.close();
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown failed', { error: String(error) });
    process.exit(1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
