import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, openSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import pg from 'pg';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import {
  ADMIN_EMAIL,
  API_PORT,
  API_URL,
  ENV_DATABASE_URL,
  ENV_MAILPIT_URL,
  USER_PASSWORD,
  WEB_PORT,
  WEB_URL,
} from './stack-config';

const WEB_DIR = join(import.meta.dirname, '..', '..', '..');
const ROOT = join(WEB_DIR, '..');
const API_DIR = join(ROOT, 'cms-api');
const LOG_DIR = join(WEB_DIR, 'test-results', 'stack');
const MAILPIT_HTTP = 8025;
const MAILPIT_SMTP = 1025;
const READY_TIMEOUT_MS = 60_000;
const READY_POLL_MS = 250;

interface Services {
  readonly postgres: string;
  readonly redis: string;
  readonly minio: string;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly mailpit: string;
  stop(): Promise<void>;
}

async function startServices(): Promise<Services> {
  const [postgres, redis, minio, mailpit] = await Promise.all([
    new PostgreSqlContainer('postgres:15-alpine').start(),
    new RedisContainer('redis:7-alpine').start(),
    // Official MinIO images are no longer public, as ADR-0013 records.
    new GenericContainer('bitnamilegacy/minio:2025.7.23')
      .withEnvironment({
        MINIO_ROOT_USER: 'e2e-only-key',
        MINIO_ROOT_PASSWORD: 'e2e-only-secret',
        MINIO_DEFAULT_BUCKETS: 'cms-media',
      })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forHttp('/minio/health/live', 9000))
      .start(),
    new GenericContainer('axllent/mailpit:v1.27')
      .withExposedPorts(MAILPIT_HTTP, MAILPIT_SMTP)
      .withWaitStrategy(Wait.forHttp('/livez', MAILPIT_HTTP))
      .start(),
  ]);
  const containers: StartedTestContainer[] = [postgres, redis, minio, mailpit];
  return {
    postgres: postgres.getConnectionUri(),
    redis: redis.getConnectionUrl(),
    minio: `http://localhost:${String(minio.getMappedPort(9000))}`,
    smtpHost: mailpit.getHost(),
    smtpPort: mailpit.getMappedPort(MAILPIT_SMTP),
    mailpit: `http://${mailpit.getHost()}:${String(mailpit.getMappedPort(MAILPIT_HTTP))}`,
    stop: async () => {
      await Promise.all(containers.map((container) => container.stop()));
    },
  };
}

function apiEnv(services: Services): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'development',
    HTTP_PORT: String(API_PORT),
    PUBLIC_URL: WEB_URL,
    CORS_ALLOWED_ORIGINS: WEB_URL,
    DATABASE_URL: services.postgres,
    REDIS_URL: services.redis,
    JWT_SECRET: randomBytes(64).toString('hex'),
    // Every flow signs in from one address, and these limits have tests of their own.
    RATE_LIMIT_LOGIN_PER_MIN: '10000',
    RATE_LIMIT_PASSWORD_RESET_PER_HOUR: '10000',
    RATE_LIMIT_INVITATION_PER_HOUR: '10000',
    RATE_LIMIT_PUBLIC_API_PER_MIN: '10000',
    OBJECT_STORAGE_PROVIDER: 'minio',
    OBJECT_STORAGE_ENDPOINT: services.minio,
    OBJECT_STORAGE_REGION: 'us-east-1',
    OBJECT_STORAGE_BUCKET: 'cms-media',
    OBJECT_STORAGE_ACCESS_KEY: 'e2e-only-key',
    OBJECT_STORAGE_SECRET_KEY: 'e2e-only-secret',
    WORKER_SCHEDULED_PUBLISH_INTERVAL_SEC: '1',
    EMAIL_PROVIDER: 'smtp',
    EMAIL_FROM: 'no-reply@e2e.test',
    SMTP_HOST: services.smtpHost,
    SMTP_PORT: String(services.smtpPort),
    SMTP_SECURE: 'false',
    LOG_LEVEL: 'info',
  };
}

function runToEnd(command: string, cwd: string, env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(command, { cwd, env, shell: true, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stdout}${result.stderr}`);
}

function startProcess(name: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv) {
  const log = openSync(join(LOG_DIR, `${name}.log`), 'w');
  return spawn(process.execPath, args, { cwd, env, stdio: ['ignore', log, log] });
}

// A leftover server on these ports would answer for the one this run starts.
async function assertPortFree(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => {
      reject(new Error(`Port ${String(port)} is in use. Stop whatever holds it first.`));
    });
    probe.listen(port, () => {
      probe.close(() => {
        resolve();
      });
    });
  });
}

function failsIfItExits(name: string, child: ChildProcess): Promise<never> {
  return new Promise((_resolve, reject) => {
    child.once('exit', (code) => {
      reject(new Error(`${name} exited with ${String(code)} during startup. See ${LOG_DIR}.`));
    });
  });
}

async function waitFor(url: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ok = await fetch(url).then(
      (response) => response.ok,
      () => false,
    );
    if (ok) return;
    await new Promise((resolve) => {
      setTimeout(resolve, READY_POLL_MS);
    });
  }
  throw new Error(`${url} did not become ready. See ${LOG_DIR}.`);
}

async function prepareDatabase(services: Services, env: NodeJS.ProcessEnv): Promise<void> {
  const client = new pg.Client({ connectionString: services.postgres });
  await client.connect();
  await client.query('CREATE ROLE cms_app NOLOGIN');
  await client.end();
  runToEnd('pnpm exec prisma migrate deploy', API_DIR, env);
  runToEnd('pnpm build', API_DIR, env);
  runToEnd('node dist/composition/seed-admin.js', API_DIR, {
    ...env,
    SEED_ADMIN_EMAIL: ADMIN_EMAIL,
    SEED_ADMIN_PASSWORD: USER_PASSWORD,
  });
}

// The whole system as a user meets it: built SPA, API and worker, with real database, cache,
// storage and mail servers, in containers that exist for this run alone.
export default async function globalSetup(): Promise<() => Promise<void>> {
  mkdirSync(LOG_DIR, { recursive: true });
  await Promise.all([assertPortFree(API_PORT), assertPortFree(WEB_PORT)]);
  const services = await startServices();
  const running: ChildProcess[] = [];
  const stop = async () => {
    for (const child of running) child.kill();
    await services.stop();
  };
  try {
    const env = apiEnv(services);
    await prepareDatabase(services, env);
    runToEnd('pnpm build', WEB_DIR);
    const api = startProcess('api', ['dist/main.js'], API_DIR, env);
    const worker = startProcess('worker', ['dist/worker.js'], API_DIR, env);
    const web = startProcess(
      'web',
      ['node_modules/vite/bin/vite.js', 'preview', '--port', String(WEB_PORT), '--strictPort'],
      WEB_DIR,
      { ...process.env, CMS_API_PROXY: API_URL },
    );
    running.push(api, worker, web);
    const crashes = [
      failsIfItExits('The API', api),
      failsIfItExits('The worker', worker),
      failsIfItExits('The web server', web),
    ];
    // Stopping them at the end of the run also ends these, and nobody is waiting by then.
    for (const crash of crashes) crash.catch(() => undefined);
    await Promise.race([Promise.all([waitFor(`${API_URL}/readyz`), waitFor(WEB_URL)]), ...crashes]);
    process.env[ENV_DATABASE_URL] = services.postgres;
    process.env[ENV_MAILPIT_URL] = services.mailpit;
    return stop;
  } catch (error) {
    await stop();
    throw error;
  }
}
