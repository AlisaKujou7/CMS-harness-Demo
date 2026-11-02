import { describe, expect, it } from 'vitest';
import { InMemoryLogger } from '../../../../test/fakes/system.fakes.js';
import { InProcessEventPublisher } from './in-process-event-publisher.js';

interface Ping {
  readonly type: 'Ping';
  readonly value: number;
}

describe('InProcessEventPublisher', () => {
  it('delivers an event to each subscriber of its type, in order', async () => {
    const publisher = new InProcessEventPublisher(new InMemoryLogger());
    const seen: string[] = [];
    publisher.subscribe<Ping>('Ping', (event) => {
      seen.push(`a${String(event.value)}`);
      return Promise.resolve();
    });
    publisher.subscribe<Ping>('Ping', (event) => {
      seen.push(`b${String(event.value)}`);
      return Promise.resolve();
    });

    const ping: Ping = { type: 'Ping', value: 1 };
    await publisher.publishAll([ping]);

    expect(seen).toEqual(['a1', 'b1']);
  });

  it('ignores events with no subscriber', async () => {
    const publisher = new InProcessEventPublisher(new InMemoryLogger());

    await expect(publisher.publishAll([{ type: 'Nobody' }])).resolves.toBeUndefined();
  });

  it('keeps delivering after a subscriber fails, and logs the failure', async () => {
    const logger = new InMemoryLogger();
    const publisher = new InProcessEventPublisher(logger);
    const seen: string[] = [];
    publisher.subscribe('Ping', () => Promise.reject(new Error('boom')));
    publisher.subscribe('Ping', () => {
      seen.push('second');
      return Promise.resolve();
    });

    await publisher.publishAll([{ type: 'Ping' }]);

    expect(seen).toEqual(['second']);
    expect(logger.errors).toEqual([
      { message: 'Event subscriber failed', context: { event: 'Ping', error: 'boom' } },
    ]);
  });

  it('logs a thrown value that is not an Error', async () => {
    const logger = new InMemoryLogger();
    const publisher = new InProcessEventPublisher(logger);
    publisher.subscribe('Pong', () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- covers non-Error throws
      throw 'plain';
    });

    await publisher.publishAll([{ type: 'Pong' }]);

    expect(logger.errors[0]?.context).toEqual({ event: 'Pong', error: 'plain' });
  });
});
