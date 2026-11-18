export interface DomainEvent {
  readonly type: string;
}

// Publish after the transaction commits, so subscribers never act on work that rolled back.
export interface DomainEventPublisher {
  publishAll(events: readonly DomainEvent[]): Promise<void>;
}
