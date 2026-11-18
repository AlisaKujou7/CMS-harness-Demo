import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import {
  startMaintenance,
  type MaintenanceRunner,
} from '../../../src/shared/adapters/out/bullmq-maintenance.js';
import { InMemoryLogger } from '../../fakes/system.fakes.js';

describe('maintenance worker against real Redis', () => {
  const runners: MaintenanceRunner[] = [];
  const url = () => `${inject('redisUrl')}/4`;
  const start = async (
    jobs: Parameters<typeof startMaintenance>[1],
    logger = new InMemoryLogger(),
    name = `test-${randomUUID()}`,
  ) => {
    const runner = await startMaintenance(url(), jobs, logger, name);
    runners.push(runner);
    return { runner, logger, name };
  };

  afterEach(async () => {
    await Promise.all(runners.splice(0).map((runner) => runner.close()));
  });

  it('runs each job repeatedly, and only its own handler', async () => {
    let fast = 0;
    let slow = 0;

    await start([
      {
        name: 'fast',
        everyMs: 50,
        run: () => {
          fast += 1;
          return Promise.resolve();
        },
      },
      {
        name: 'slow',
        everyMs: 60_000,
        run: () => {
          slow += 1;
          return Promise.resolve();
        },
      },
    ]);

    await vi.waitFor(() => {
      expect(fast).toBeGreaterThanOrEqual(3);
    });
    expect(slow).toBeLessThanOrEqual(1);
  });

  it('logs a failure and keeps the schedule running', async () => {
    let runs = 0;
    const { logger } = await start([
      {
        name: 'flaky',
        everyMs: 50,
        run: () => {
          runs += 1;
          return runs === 1 ? Promise.reject(new Error('boom')) : Promise.resolve();
        },
      },
    ]);

    await vi.waitFor(() => {
      expect(runs).toBeGreaterThanOrEqual(2);
    });
    expect(logger.errors[0]).toMatchObject({
      message: 'Maintenance job failed',
      context: { job: 'flaky', error: 'boom' },
    });
  });

  it('keeps one schedule per job when several workers start', async () => {
    const job = { name: 'once', everyMs: 60_000, run: () => Promise.resolve() };
    const { name } = await start([job]);
    await start([job], new InMemoryLogger(), name);

    const queue = new Queue(name, { connection: { url: url() } });
    try {
      await expect(queue.getJobSchedulersCount()).resolves.toBe(1);
    } finally {
      await queue.close();
    }
  });
});
