import { randomUUID } from 'node:crypto';
import type { Worker } from 'bullmq';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import {
  BullMqEmailQueue,
  startEmailWorker,
} from '../../../src/shared/adapters/out/bullmq-email-queue.js';
import { InMemoryEmailSender, InMemoryLogger } from '../../fakes/system.fakes.js';

const message = { to: 'user@example.com', subject: 'Hello', text: 'Secret link token=abc' };

describe('email queue against real Redis', () => {
  let queue: BullMqEmailQueue | undefined;
  let worker: Worker | undefined;

  const start = (sender: InMemoryEmailSender, logger = new InMemoryLogger()) => {
    const url = `${inject('redisUrl')}/3`;
    const name = `test-${randomUUID()}`;
    queue = new BullMqEmailQueue(url, { attempts: 2, backoffMs: 10, queueName: name });
    worker = startEmailWorker(url, sender, logger, name);
    return { logger };
  };

  afterEach(async () => {
    await worker?.close();
    await queue?.close();
  });

  it('returns without waiting for delivery, which then happens in the worker', async () => {
    const sender = new InMemoryEmailSender();
    start(sender);

    await queue?.send(message);

    await vi.waitFor(() => {
      expect(sender.sent).toEqual([message]);
    });
  });

  it('retries a failed delivery', async () => {
    const sender = new InMemoryEmailSender();
    let failures = 1;
    const send = sender.send.bind(sender);
    sender.send = (mail) => {
      if (failures > 0) {
        failures -= 1;
        return Promise.reject(new Error('smtp down'));
      }
      return send(mail);
    };
    const { logger } = start(sender);

    await queue?.send(message);

    await vi.waitFor(() => {
      expect(sender.sent).toEqual([message]);
    });
    expect(logger.errors).toEqual([]);
  });

  it('logs when it gives up, without the message or its link', async () => {
    const sender = new InMemoryEmailSender();
    sender.failWith = new Error('smtp down');
    const { logger } = start(sender);

    await queue?.send(message);

    await vi.waitFor(() => {
      expect(logger.errors).toEqual([
        { message: 'Email delivery gave up', context: { attempts: 2 } },
      ]);
    });
    expect(JSON.stringify(logger.errors)).not.toContain('token=abc');
  });

  it('fails fast when Redis is unreachable, so the caller can log it', async () => {
    const unreachable = new BullMqEmailQueue('redis://127.0.0.1:1', {
      attempts: 1,
      backoffMs: 10,
      queueName: 'nowhere',
    });
    unreachable.onConnectionError(() => undefined);

    await expect(unreachable.send(message)).rejects.toThrow('Timed out enqueueing');
    // Closing would wait for a connection that never comes.
    void unreachable.close();
  });
});
