# ADR-0009: Publish domain events in process

## Status

Accepted

## Context

Audit and cache invalidation react to domain events, but there is only one deployable.

## Decision

`InProcessEventPublisher` implements the port for the MVP. Redis pub/sub can replace it later.

## Consequences

- Positive: no broker to operate.
- Negative: events do not cross processes until replaced.

## Alternatives Considered

A message broker now, rejected as premature.
