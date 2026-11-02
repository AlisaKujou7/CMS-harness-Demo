# ADR-0007: Prisma as the ORM behind persistence mappers

## Status

Accepted

## Context

Migrations and typed queries are needed without leaking ORM types.

## Decision

Use Prisma, with mappers in `adapters/out/persistence`. dependency-cruiser blocks third-party imports in `application`.

## Consequences

- Positive: the ORM can be replaced behind ports.
- Negative: mapping code per entity.

## Alternatives Considered

TypeORM, rejected because its decorators invite domain coupling.
