import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createAppModule } from './composition/app.module.js';
import { createInfrastructure } from './composition/infrastructure.js';
import { loadEnv } from './config/env.schema.js';
import { configureApp } from './shared/adapters/http/configure-app.js';

const config = loadEnv(process.env);
const { infrastructure, dispose } = createInfrastructure(config);

const app = await NestFactory.create(createAppModule(infrastructure), { logger: false });
configureApp(app, infrastructure);
app.enableShutdownHooks();
await app.listen(config.httpPort);
infrastructure.logger.info('API listening', { port: config.httpPort });

async function shutdown(): Promise<void> {
  await app.close();
  await dispose();
}

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
