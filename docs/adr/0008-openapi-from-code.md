# ADR-0008: Generate OpenAPI from code and FE types from the spec

## Status

Accepted

## Context

The frontend and backend must not drift (06-TEST-STRATEGY §9.1).

## Decision

The backend emits `openapi.json`. CI fails on a diff against the committed copy. The frontend generates types from it.

## Consequences

- Positive: drift fails at compile time.
- Negative: a generation step in the build.

## Alternatives Considered

Shared TypeScript packages, rejected because 04-ARCH §6.1 shares contracts rather than types.
