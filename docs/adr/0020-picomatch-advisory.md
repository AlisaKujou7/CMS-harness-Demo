# ADR-0020: Allow one picomatch advisory in the dependency audit until a fix exists

## Status

Accepted, pending review by the Tech Lead. Recheck by 2026-12-18.

## Context

On 2026-11-18 the Dependency CVEs step of `pnpm gate` (`pnpm audit --audit-level high`) failed on [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), a high ReDoS in `picomatch` up to 4.0.7 through repeated extglobs. No fixed version exists, so neither an upgrade nor an override can clear it. The package arrives only through development tools, such as `@stoplight/spectral-cli`, `lint-staged` and build tooling, over 103 paths. `pnpm audit --prod --audit-level high` finds nothing, so the code that runs in production does not contain it. Those tools read globs from the repository's own configuration, not from outside users. While the step fails, the Claude Code hook refuses every ordinary commit.

## Decision

`pnpm-workspace.yaml` lists `GHSA-fc5q-39xc-vjpf` under `auditConfig.ignoreGhsas`, with a comment that names this ADR and the recheck date. Only that advisory is ignored: with any other ID in the list, the same audit fails again on picomatch. The audit still prints `1 ignored: 1 high`, so the exception stays visible in every gate run.

## Consequences

- Positive: the gate passes again without weakening the step for any other advisory, high or otherwise.
- Negative: a developer machine runs tools with a known ReDoS until a fix exists. The input is the repository's own globs, so the risk is low.
- Negative: nothing in the gate fails when the recheck date passes. `docs/harness/STATUS.md` lists the recheck as an open task.
- Remove the entry once picomatch publishes a fixed version and the tools take it, or an override can pin it.

## Alternatives Considered

`--ignore-unfixable`, rejected because it would hide every future advisory without a fix. Auditing production dependencies only, rejected because it would weaken the step for good. Removing the tools that pull picomatch in, rejected because they are the formatter, linter and OpenAPI checks the gate itself depends on.
