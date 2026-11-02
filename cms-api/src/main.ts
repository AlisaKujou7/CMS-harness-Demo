import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createAppModule } from './composition/app.module.js';
import { createInfrastructure } from './composition/infrastructure.js';
import { loadEnv } from './config/env.schema.js';
import { buildOpenApiDocument } from './composition/openapi/build-document.js';
import { mountApiDocs } from './shared/adapters/http/api-docs.js';
import { configureApp } from './shared/adapters/http/configure-app.js';

const config = loadEnv(process.env);
const { infrastructure, dispose } = createInfrastructure(config);

const app = await NestFactory.create(createAppModule(infrastructure), { logger: false });
configureApp(app, infrastructure);
mountApiDocs(app, buildOpenApiDocument());
await app.listen(config.httpPort);
infrastructure.logger.info('API listening', { port: config.httpPort });

// The only shutdown path. Nest's enableShutdownHooks would also close the app and then re-raise
// the signal, ending the process before the connections below are released.
async function shutdown(signal: string): Promise<void> {
  try {
    infrastructure.logger.info('Shutting down', { signal });
    await app.close();
    await dispose();
    process.exit(0);
  } catch (error) {
    infrastructure.logger.error('Shutdown failed', { error: String(error) });
    process.exit(1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
