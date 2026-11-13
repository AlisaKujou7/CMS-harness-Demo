import type { DomainEvent, DomainEventPublisher } from '../../ports/event-publisher.port.js';
import type { Logger } from '../../ports/system.port.js';

type Subscriber = (event: never) => Promise<void>;

// ADR-0009. Events are published after the work has committed, so a failing subscriber is logged
// rather than failing a request that has already succeeded.
export class InProcessEventPublisher implements DomainEventPublisher {
  private readonly subscribers = new Map<string, Subscriber[]>();

  constructor(private readonly logger: Logger) {}

  subscribe<E extends DomainEvent>(type: E['type'], subscriber: (event: E) => Promise<void>): void {
    this.subscribers.set(type, [...(this.subscribers.get(type) ?? []), subscriber]);
  }

  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const subscriber of this.subscribers.get(event.type) ?? []) {
        await this.deliver(subscriber, event);
      }
    }
  }

  private async deliver(subscriber: Subscriber, event: DomainEvent): Promise<void> {
    try {
      await subscriber(event as never);
    } catch (error) {
      this.logger.error('Event subscriber failed', {
        event: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
