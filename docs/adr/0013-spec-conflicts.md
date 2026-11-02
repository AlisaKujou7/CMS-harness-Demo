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
- Migrations: NFR-MAIN-03 says reversible and 07-OPS-ARCH §12.2 says forward-only. They are forward-only, and reversibility comes from the expand and contract pattern, so the previous release keeps working against a newer schema.
- Rate limiter outage: it fails open and logs, since account lockout lives in Postgres and still applies. No document decides this.
- `POST /api/admin/auth/password/change` is added for the Profile screen in 02-SRS §4.1, which §7 omits.
- Authentication reads users through an `Account` view in the auth module. The users module owns the user lifecycle from phase 2, and both use the `users` table.
- Inbound and outbound ports of a module share grouped files (`auth.ports.ts`, `repositories.port.ts`) rather than one file per port as the 04-ARCH §4.10 tree shows. The dependency rules are unaffected.
- Last admin: FR-USER-04 only names deletion. Demoting or deactivating the last active Admin is refused too, because the result is the same lockout.
- Deleting a user is a hard delete and is refused while other records reference them. Deactivation is the normal path, which keeps attribution (FR-USER-05).
- Admin password reset (UR-A05) emails the owner a link. The Admin never sets or sees a password.
- Invitations use their own table and a 7 day token, separate from password resets, so one link can never act as the other.
- Audit log: a trigger rejects UPDATE and DELETE for everyone, and the `cms_app` role also lacks those permissions plus TRUNCATE, as the FR-AUDIT-03 acceptance test asks. Exporting the log is itself audited.
- `POST /api/admin/users/{id}/reset-password`, `POST /api/admin/users/{id}/resend-invite`, `DELETE /api/admin/users/{id}`, `POST /api/admin/auth/invitations/accept` and `GET /api/admin/auth/me` are added. 02-SRS §7 omits them, while FR-USER, UR-A05 and the Profile screen need them.
- Account lockout: an attempt is charged before the password is checked, under a row lock, and a correct password clears it. This is what limits parallel guesses to 5. Failure times are stored so the 10 minute window slides, as FR-AUTH-06 words it. Changing a password shares the same counter.
- The migration that replaced the lockout columns drops them in one step instead of using expand and contract, because no release has shipped. Later migrations follow 07-OPS-ARCH §12.3.
- `TRUST_PROXY` defaults to false, so a client cannot choose its own IP unless a proxy is declared. Deployments behind nginx must set it, or every client shares one rate limit bucket.
- `SMTP_SECURE=true` means mail must be encrypted: implicit TLS on port 465 and required STARTTLS on any other port.
- User writes change only the fields that changed. Two admins editing one user at once cannot undo each other's deactivation or role change, though the last rename wins.
- Invitation acceptance has its own rate limit, 30 per hour per IP by default, because SEC-07 sets 5 for password resets and an office shares one IP.
- An Admin password reset for a user who is not active returns 409, rather than the silent success the public forgot flow uses.
- Email goes through a BullMQ queue and `dist/worker.js`, which 04-ARCH lists. 07-OPS-ARCH §9.2 sets Redis to `allkeys-lru`, which can evict queued jobs. Phase 8 must use `noeviction` for the queue, on a separate Redis instance from the cache if needed.
- Queued emails hold reset links in Redis until delivered or retries run out, about 2 minutes, and are then removed. Redis is on the internal network and requires a password.
- `page` is limited to 1,000,000.

## Consequences

- Positive: every interpretation is written down and reversible.
- Negative: some choices belong to roles that have not reviewed them yet.

## Alternatives Considered

Stopping to ask about each conflict, rejected because each one is cheap to reverse.
