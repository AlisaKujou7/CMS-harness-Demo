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
- FR-CONTENT-06 and FR-SEO-02: the meta description is required to publish but defaults to the body text. An explicit description or a body with text satisfies it, so only an image-only body needs one typed in.
- 5.4.1 draws no transition from Draft straight to Published, but the FR-CONTENT-04 acceptance test allows it for Editors, so the lifecycle allows it and the role check limits it.
- 5.4.1 says an edit moves Unpublished to Draft. Published content stays Published when an Editor edits it, and must stay publishable. An Author cannot edit their own content while it is In Review or Published (409), because it is with the Editors until it comes back. Archived content cannot be edited by anyone.
- `POST /content/{id}/reject`, `POST /content/{id}/archive`, `GET /content/{id}/versions/{no}`, `GET /content/stats` and `GET /content/categories` are added. 02-SRS §7 omits them, while the lifecycle, the dashboard and the editor need them.
- `PATCH /content/{id}` requires the `version` the editor loaded, and a mismatch returns 409 `CONTENT_CHANGED`. 03-DESIGN §19.4 shows the dialog, but the API needs this to detect the conflict. Saves also check the version in the database, so two simultaneous writers cannot both win.
- A save that changes nothing creates no version and no audit event.
- History is only open to those who may edit: an Author can read another author's published article but not its earlier drafts.
- A revert restores what the item says, not its lifecycle state, and follows the same rules as an edit.
- A soft-deleted item gives up its slug at once, enforced by a partial unique index on live rows, because nothing can show or free a slug during those 30 days. Nothing restores deleted content through the API yet, so the Undo that 03-DESIGN shows for delete and unpublish is still open for phase 6, and a restore must handle a slug taken in the meantime.
- A slug generated from a title with no Latin letters or digits, such as a Thai title, falls back to `content-<id prefix>`, which the author can edit. FR-CONTENT-02 asks for a URL-safe slug and NFR-I18N does not ask for transliteration.
- SEC-04 needs executable tags gone from what the API returns, and no list of dangerous tags is ever complete, so every HTML tag is removed from title, SEO fields, tags, category, review notes, image and link attributes, and text nodes. `<script>`, `<style>`, `<iframe>` and `<object>` lose their content too when they have an end tag. Formatting lives in marks, so a real tag in text has no meaning. An article can only quote tags inside a code block, which keeps its text exactly, so consumers must escape code blocks when rendering them. A comparison such as `1 < 2` stays.
- An Author cannot edit or revert their draft while it is scheduled (409 `CONTENT_SCHEDULED`), because an Editor approved that text and the worker would publish changes nobody reviewed. An Editor can edit it or cancel the schedule.
- The JSON body limit is 2 MB on content routes only, since a rich text tree is much larger than its text. Every other route keeps the 100 KB default, and media does not pass through the API (FR-MEDIA-04).
- Categories come from the `CONTENT_CATEGORIES` setting, since the Requirements doc §6.2 says "predefined list" without naming one or a screen to manage it. A category is checked only when it changes, so removing one from the list does not block other saves.
- The list hides Archived items unless `status=archived` is asked for. The date range filters `updated_at`, the date the list shows.
- Reference columns for media stay plain UUIDs until phase 4 adds the table and its foreign keys.
- A scheduled publish that can no longer succeed clears the schedule and writes `content.schedule_failed` to the audit log, since retrying would never succeed. Nothing notifies the Editor yet, because no notification feature is in scope.
- Purging runs in batches of 100, each in its own transaction, and each audit event names the ids removed.
- Worker jobs use BullMQ job schedulers. `purge-expired-tokens` also runs there, deleting tokens past their expiry, since replay detection only matters until then.

## Consequences

- Positive: every interpretation is written down and reversible.
- Negative: some choices belong to roles that have not reviewed them yet.

## Alternatives Considered

Stopping to ask about each conflict, rejected because each one is cheap to reverse.
