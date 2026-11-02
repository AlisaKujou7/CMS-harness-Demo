# ADR-0001: Use Hexagonal Architecture for the backend

## Status

Accepted

## Context

The domain must stay testable and independent of NestJS, Prisma and every vendor (04-ARCH §1.2).

## Decision

Each module owns `domain`, `application` and `adapters`. dependency-cruiser enforces 04-ARCH §4.8 in `cms-api/.dependency-cruiser.cjs`.

## Consequences

- Positive: fast unit tests and replaceable infrastructure.
- Negative: more files for simple features.

## Alternatives Considered

Layered MVC, rejected because framework types leak into business rules.
