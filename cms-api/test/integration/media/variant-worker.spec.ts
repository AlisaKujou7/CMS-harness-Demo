import { randomUUID } from 'node:crypto';
import type { Worker } from 'bullmq';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { startVariantWorker } from '../../../src/modules/media/adapters/in/queue/variant-worker.js';
import { BullMqVariantQueue } from '../../../src/modules/media/adapters/out/queue/bullmq-variant-queue.js';
import { InMemoryLogger } from '../../fakes/system.fakes.js';

describe('media variant queue against real Redis', () => {
  let queue: BullMqVariantQueue | undefined;
  let worker: Worker | undefined;

  const start = (execute: (mediaId: string) => Promise<void>) => {
    const url = `${inject('redisUrl')}/7`;
    const name = `test-${randomUUID()}`;
    const logger = new InMemoryLogger();
    queue = new BullMqVariantQueue(url, name);
    worker = startVariantWorker(url, name, { execute }, logger);
    return { logger };
  };

  afterEach(async () => {
    await worker?.close();
    await queue?.close();
  });

  it('hands a queued id to the use case', async () => {
    const seen: string[] = [];
    start((mediaId) => {
      seen.push(mediaId);
      return Promise.resolve();
    });

    await queue?.enqueue('media-1');

    await vi.waitFor(() => {
      expect(seen).toEqual(['media-1']);
    });
  });

  it('can queue the same media again once the job is done, as the sweep needs', async () => {
    const seen: string[] = [];
    start((mediaId) => {
      seen.push(mediaId);
      return Promise.resolve();
    });

    await queue?.enqueue('media-1');
    await vi.waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    await vi.waitFor(async () => {
      await queue?.enqueue('media-1');
      expect(seen.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('logs a failed job', async () => {
    const { logger } = start(() => Promise.reject(new Error('storage went away')));

    await queue?.enqueue('media-1');

    await vi.waitFor(() => {
      expect(logger.errors[0]).toMatchObject({
        message: 'Media variant job failed',
        context: { mediaId: 'media-1', error: 'storage went away' },
      });
    });
  });
});
