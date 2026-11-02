# ADR-0011: Toolchain versions differ from the onboarding guide

## Status

Accepted

## Context

09-ONBOARDING names Node 20, whose support ended in April 2026, while 02-SRS §2.5 requires a stack with active LTS support. The latest typescript-eslint supports TypeScript below 6.1 only. The Prisma `latest` dist-tag points at `8.0.0-rc.29`, a release candidate.

## Decision

- Node 26.13.0 LTS. Smoke tested on Windows with argon2, sharp and NestJS.
- pnpm 12.
- TypeScript 6.0.3, not 7.
- Prisma 7.10.1, the latest stable release, not the RC.
- React 18.3.1 and MUI v6 as documented in 03-DESIGN and 09-ONBOARDING, even though newer majors exist.
- `cms-api` is an ES module package using `.js` import specifiers.

## Consequences

- Positive: every runtime is in support and linting works.
- Negative: TypeScript and React are behind their latest majors, so revisit when typescript-eslint allows it.

## Alternatives Considered

Node 20, rejected as out of support. TypeScript 7, rejected because linting would break.
