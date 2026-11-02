# ADR-0005: Zustand for UI state, RxJS for cross-cutting streams

## Status

Accepted

## Context

UI state is small, while autosave and uploads are genuinely stream-shaped.

## Decision

Zustand slices hold UI state. RxJS holds autosave, upload progress, connectivity and idle session.

## Consequences

- Positive: stream logic is testable with virtual time.
- Negative: RxJS has a learning curve.

## Alternatives Considered

Effects in components, rejected because 04-ARCH §5.5.2 forbids them.
