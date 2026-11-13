# ADR-0017: Trace each FR code to a test

## Status

Accepted, pending review by the Tech Lead

## Context

Every gate could pass while a feature in the specifications was missing, because no gate compared the work with the requirement codes. 02-SRS 11.3 asks for a traceability matrix. 08-GIT-WORKFLOW 16.1 makes quality gate changes a Tech Lead decision through an ADR.

## Decision

Add a `traceability` step to `pnpm gate`. It reads the FR codes from the tables in 02-SRS, and fails when a code is named by no test and is not listed in `tools/gates/traceability-exceptions.json` with a reason. An exception also fails when its code is not in the specification, or when a test now names it, so the list cannot go stale.

It covers FR only for now. UR, NFR, SEC and BR would each need their own decision.

## Consequences

- Positive: a requirement cannot be forgotten silently, and the check reads the specification itself, so a new code fails at once.
- Negative: it proves that a test names a code, not that the test proves the requirement. Anyone can add a code to an unrelated test, so a person must read what gets added. A code named once also says nothing about how much of a broad requirement is covered, as with FR-AUDIT-02.

## Alternatives Considered

A matrix in a tracking tool, as 02-SRS 11.3 suggests, rejected because none exists here and nothing would enforce it. A machine-readable copy of the requirements, rejected because a copy can drift from the specification.
