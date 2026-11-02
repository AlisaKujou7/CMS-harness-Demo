# ADR-0002: Use Reactive Architecture for the frontend

## Status

Accepted

## Context

The SPA has autosave, concurrent uploads and undo windows that compose poorly in component state (04-ARCH §5.1.1).

## Decision

Unidirectional flow composed from TanStack Query, Zustand, React Hook Form, React Router and RxJS.

## Consequences

- Positive: each kind of state lives in the tool suited to it.
- Negative: several libraries to learn.

## Alternatives Considered

One Redux store, rejected as ceremony without payoff for a small team (04-ARCH §5.3.3).
