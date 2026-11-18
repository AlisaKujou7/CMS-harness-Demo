# ADR-0014: Allow MIT-0 and 0BSD licenses

## Status

Accepted, pending review by the Tech Lead

## Context

M-LIC-03 allows MIT, Apache-2.0, BSD-2/3, ISC and MPL-2.0. Two production dependencies fall outside
that list: `nodemailer` (MIT-0) and `tslib` (0BSD), which NestJS requires. 08-GIT-WORKFLOW §16.1
makes quality gate threshold changes a Tech Lead decision through an ADR.

## Decision

Add MIT-0 and 0BSD to the allow-list in `tools/gates/checks.mjs`. Both are the MIT and BSD licenses
with the attribution requirement removed, so they ask less of us than licenses already allowed.

## Consequences

- Positive: the license gate passes without a waiver and without replacing NestJS or the mailer.
- Negative: the list in 05-METRICS M-LIC-03 needs updating to match.

## Alternatives Considered

A waiver, rejected because it expires after 30 days while these dependencies are permanent.
Replacing `nodemailer`, rejected because it would not solve `tslib`.
