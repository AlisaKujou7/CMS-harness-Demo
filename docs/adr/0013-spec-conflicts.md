# ADR-0013: How conflicts between the specifications are resolved

## Status

Accepted, pending review by the Product Owner and Tech Lead

## Context

The documents disagree in places. 02-SRS §1.1 makes the SRS authoritative over informal communication, but 05-METRICS and 07-OPS-ARCH are later and more specific.

## Decision

The stricter or more specific document wins unless noted.

- Coverage: 98% from 05-METRICS, not 70% from NFR-MAIN-01.
- Load: 200 RPS from M-LOAD-01, not 50 RPS from NFR-PERF-02.
- Secrets: `.env` for the MVP from 07-OPS-ARCH §8, read through an abstraction so NFR-MAIN-04 can follow.
- Deployment: Compose on a single VM from 07-OPS-ARCH, which is the "or equivalent" in 02-SRS §2.4.
- Lifecycle: Editors and Admins may publish directly from Draft, per the 02-SRS §11.2 acceptance test. Authors may not.
- `Scheduled` is derived from `scheduled_at` for display. It is not a stored status, matching the 02-SRS §6.2 enum.
- Slug: `Slug.create` trims as in 04-ARCH §4.5.2, so the 06-TEST-STRATEGY §7.2 example expecting `"  spaced  "` to throw is corrected.
- Endpoints missing from 02-SRS §7 but required by FR and UR items are added: reject, archive, accept invite, admin password reset, user deletion.
- MFA (Q-2) is deferred to Phase 2 until the Security Lead says otherwise.
- Presentational components are the default, and a component that reads state is named `*Container.tsx` so lint can tell them apart.

## Consequences

- Positive: every interpretation is written down and reversible.
- Negative: some choices belong to roles that have not reviewed them yet.

## Alternatives Considered

Stopping to ask about each conflict, rejected because each one is cheap to reverse.
