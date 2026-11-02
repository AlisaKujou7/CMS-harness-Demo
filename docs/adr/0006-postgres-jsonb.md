# ADR-0006: PostgreSQL with JSONB content body

## Status

Accepted

## Context

Content is relational, while the body is a structured document.

## Decision

PostgreSQL is the primary store and the body is stored as JSONB (ProseMirror nodes).

## Consequences

- Positive: one transactional store.
- Negative: body queries are limited, which matches the title-only search in scope.

## Alternatives Considered

Sanitized HTML columns, rejected because a portable JSON tree is easier to validate.
