# ADR-0012: Monorepo with pnpm workspaces

## Status

Accepted

## Context

09-ONBOARDING §6.1 allows a monorepo or several repositories. The team is small, and API contract changes touch both tiers.

## Decision

One repository with `cms-api`, `cms-web` and `tools`. `cms-infra` joins in phase 8. ADRs live in `docs/adr` per 04-ARCH §8. The specifications stay in `AIAGENT_POC` and are not reformatted.

## Consequences

- Positive: atomic contract changes and one gate.
- Negative: CI runs for both tiers on every PR.

## Alternatives Considered

Separate repositories, rejected because the contract would need cross-repository coordination.
