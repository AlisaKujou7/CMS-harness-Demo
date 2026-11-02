# ADR-0003: Single modular monolith

## Status

Accepted

## Context

MVP scale and a small team do not justify service boundaries.

## Decision

One deployable with module boundaries enforced by tooling. Modules talk through inbound ports or domain events.

## Consequences

- Positive: simple deployment and transactions.
- Negative: modules scale together.

## Alternatives Considered

Microservices, rejected for operational cost at MVP scale.
