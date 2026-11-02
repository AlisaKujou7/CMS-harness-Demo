# ADR-0004: TanStack Query for server state

## Status

Accepted

## Context

Server state needs caching, refetching and invalidation.

## Decision

Use TanStack Query, with query keys shaped as `[feature, ...]`.

## Consequences

- Positive: no hand-written cache.
- Neutral: server state stays out of Zustand.

## Alternatives Considered

Redux Toolkit Query, rejected because it would pull in a store the design avoids.
