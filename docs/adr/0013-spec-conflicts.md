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
- Uploads land under `uploads/<owner>/<id>.<ext>`, the only place a presigned URL can write. Finalizing checks the stored type, extension and bytes, then copies the file to `media/<id>/` on the condition that it has not changed. Without this, a second PUT to the same URL could replace a checked file. A refused file is deleted, and the attempt is audited as `media.upload_rejected`. The media id is the upload id, so one upload cannot become two records.
- Only the uploader can finalize an upload, an Admin included.
- `POST /media` takes `storage_key`, `filename` and `mime_type`, plus optional `alt_text` and `caption`. `GET /media/{id}` is added, with `usage_count` for the details drawer. `DELETE /media/{id}?force=true` is how FR-MEDIA-07's Admin force-delete is asked for. 02-SRS §7 leaves all of this open.
- All signed-in roles can browse the whole library, since UR-E04 says it gives Authors access to approved assets. Authors change and delete only what they uploaded, Editors and Admins anything. 5.3.1 lists delete only, and updating follows the same rule.
- SVG is limited to 5 MB, below the 20 MB general limit, because sanitizing parses the whole document. It is rebuilt from an allow-list of elements and attributes, and refused if it declares entities. Scripts, styles, links, external references, `image` and `foreignObject` do not survive.
- Variants are WebP within 320 and 1024 pixels, including for GIF (first frame) and SVG, and strip metadata. The original keeps its EXIF, including any location, because it is what the author uploaded. PDFs get no variants. `variant_status` is added to MediaItem so the SPA can tell waiting from failed, and a sweep requeues any left waiting, since the queue is not transactional with the database.
- PDFs are served as downloads and images inline, using signed URLs that last an hour by default (SEC-06). `OBJECT_STORAGE_PUBLIC_URL` is what those URLs are signed for. A CDN in front must pass the query string through, or phase 8 must add CDN signing.
- Inline image nodes keep `src` and `mediaId`, but a signed `src` expires. Phase 5 must resolve `mediaId` to a current URL in the public API, and phase 6 must do the same in the editor.
- A force-delete clears featured and social image references, and leaves an inline image node in place with a dead reference. Content may keep a reference it already had when it is saved again, but a newly added reference must exist (`MEDIA_NOT_FOUND`).
- `FEATURE_MEDIA_VARIANTS_ENABLED` from 07-OPS-ARCH is not implemented. No requirement needs variants off, and it would leave items waiting forever.
- Finalizing writes the record first, in one transaction with the move. The id is the upload's, so a repeat stops at the record and cannot reach the stored file, and a simultaneous repeat waits and then does the same. The file copy therefore holds a database connection briefly, which a server-side copy keeps short.
- Deleting media commits first and removes files afterwards. Keys wait in `media_file_deletions` until storage confirms, and a worker job retries them, so a storage outage leaves a successful delete and no lost files.
- Reverting to a version whose media was since force-deleted restores everything else, drops those references, and names them in the audit event as `dropped_media`.
- Featured, social and inline image references must be images (`MEDIA_NOT_IMAGE`), since each is displayed as one. Linking a PDF remains possible with an ordinary link.
- Pending variants are given up on after a day, and marked failed, so items that can never succeed cannot fill every sweep.
- Abandoned uploads are purged after a day by a worker job (RK-03).
- Official `minio/minio` images, which 07-OPS-ARCH names, can no longer be pulled publicly. Tests and local development use `bitnamilegacy/minio`, the same server, which gets no more updates. Phase 8 must choose a supported S3 service or a maintained image for deployment.
- The public API returns only what 01-Requirements 6.2 and FR-SEO-03 name. Pages leave out author, tags and category. List items leave out the body and SEO fields, because a list of 100 could otherwise be very large. Detail responses have both.
- `GET /api/v1/media/{id}` returns only media that published content uses. 7.2 does not limit it, but anything else may belong to a draft, which RK-04 is about.
- A missing item and one that is not public both return the same 404, so the API never confirms that a draft exists.
- Stored image `src` values are replaced on each read with a current signed URL, using `mediaId`. An image whose file was force-deleted is left out of the response.
- Caching: `Cache-Control: private`, because responses depend on holding a key, so a shared cache or CDN must not reuse them. `PUBLIC_CACHE_TTL_SEC` applies twice, in Redis and in clients, and is limited to 30 so that FR-CONTENT-12's 60 seconds always holds. Publishing, unpublishing and deleting clear the Redis cache at once, while an edit to live content waits for the TTL, since it is not leaving the public set.
- ETags name a version of the response, not its bytes, because signed URLs differ on every read. A response with media changes its ETag at half the URLs' lifetime, so a client revalidating with 304 never keeps URLs past their expiry.
- The public rate limit counts per API key (SEC-07). Requests with bad keys are not limited, since a key cannot be guessed and each attempt costs one indexed read. Phase 8 may add a per-IP limit at nginx.
- `If-Modified-Since` is ignored on the public API, which RFC 9110 allows. `Last-Modified` is still sent, as FR-PUBAPI-04 asks, but a date cannot show that an item left a list or that signed URLs changed, so only `If-None-Match` can produce a 304.
- A page's parent is returned as its slug and title, and only when the parent is public too. A `parent_id` would confirm that an unpublished page exists, and consumers can only fetch by slug.
- `MEDIA_READ_URL_TTL_SEC` must be at least 4 times `PUBLIC_CACHE_TTL_SEC`, so 120 seconds by default. A client can reuse a response for half that lifetime plus two cache periods.
- OpenAPI is built from code as ADR-0008 says, but not from decorators as 06-TEST-STRATEGY 9.1 words it, because controllers validate with Zod. Requests come from the same Zod schemas the controllers use. Responses come from strict Zod schemas in `composition/openapi`, which a contract test holds every route to. The same test compares the served routes with the document and the document with the committed `openapi.json`, so `pnpm openapi:generate` is needed after an API change.
- `/docs` and `/openapi.json` need no key, since FR-PUBAPI-07 publishes them and they hold no data. They describe the Admin API too, because phase 6 generates its types from the same file. The viewer's assets are served locally with their own Content-Security-Policy.
- Worker jobs use BullMQ job schedulers. `purge-expired-tokens` also runs there, deleting tokens past their expiry, since replay detection only matters until then.

- Undo for a delete uses `POST /content/{id}/restore`, added for it. A slug taken in the meantime makes it fail with `SLUG_TAKEN`, and a schedule cleared by the delete does not come back. 03-DESIGN 15.1 names a 10 second window, which is how long the Undo is offered. The API does not enforce it, since restoring later within the 30 days does no harm.
- Undo for an unpublish uses `POST /content/{id}/unpublish/undo`, added for it. 5.4.1 draws no path from Unpublished to Published, so this is not a general transition: it only works within 60 seconds of the unpublish, as 03-DESIGN 15.1 says, and any later save closes it.
- `editor_name` is added to version list rows, because 03-DESIGN 19.5 shows the editor's name, and Editors and Authors cannot list users. It is left off a single version, which does not show it.
- The audit log and the dashboard name actors from the user list, since only Admins read either. A deleted user shows as "Someone", and the list reads the first 100 users.
- The dashboard's recent activity is the audit log for Admins. Everyone else cannot read that log, so they see recently updated content instead.
- Autosave runs saves one at a time, not with the `switchMap` that 04-ARCH 5.4.2 sketches. A cancelled request still lands on the server and moves the version on, so the next save would look like someone else's edit (`CONTENT_CHANGED`).
- The editor shows a current URL for an inline image, and saving puts back the stored `src`. Otherwise reading a fresh signed URL would count as a change and add a version. An editor left open past the URL's lifetime (an hour by default) can show a broken image if it redraws one, and reloading fixes it.
- Inline images cannot be resized with drag handles as 03-DESIGN 19.3 describes, because the sanitizer in SEC-04 keeps no size attribute, so a size would vanish on save.
- Slug uniqueness is checked when the field is saved on blur, not while typing as 03-DESIGN 12.4 says, since no endpoint checks a slug alone. The result lands on the same field.
- The privacy notice (02-SRS 10.1) is remembered per user in the browser, not on the server, so it shows again on a new device. No document asks for proof of acceptance.
- SEC-12's idle timeout is enforced by the SPA: a warning at 28 minutes and sign-out at 30. A refresh token used directly is not limited by it.
- The content list sorts by Title and Updated only, and the audit log is newest first only, because those are the orders the API offers. 03-DESIGN 12.3 and 12.7 also draw sorting on other columns.
- The author filter offers the authors in the current results, since Editors cannot list users.
- Bulk select exists for media, as 03-DESIGN 12.5 asks. The content table has no bulk actions, since 10.7 makes them optional and no endpoint exists.
- The top app bar has no notification icon, because no notification feature is in scope, and its search icon opens the content list.
- Icons come from `@mui/icons-material` in the rounded style, the same glyphs as Material Symbols, because the variable font is several megabytes and a page uses a few dozen icons.
- Navigation uses the rail from 840 pixels and the drawer below it, following the breakpoint table in 03-DESIGN 11.4 over the 1240 in 10.3, which contradicts it.
- A component is held to 200 lines (M-RX-07) rather than the 50 of M-CPX-04, because its JSX is markup. Complexity limits still apply.

- Autosave stops once content is Published, so unfinished edits do not reach the public. 03-DESIGN 19.4 asks for autosave without excepting anything, but an edit to live content stays live, as this ADR records above. Edits there wait for Save changes, and the prompt on leaving still protects them. A separate draft of live content would be better, and needs a new data model.
- An outage during a token refresh keeps the session and fails the request, so it can be retried. Only a 401 from the refresh ends the session. FR-AUTH-05 is unaffected, because a revoked token still gets that 401.
- Activity in any tab counts for SEC-12's idle timeout in every tab, because signing out revokes the session they share.

## Consequences

- Positive: every interpretation is written down and reversible.
- Negative: some choices belong to roles that have not reviewed them yet.

## Alternatives Considered

Stopping to ask about each conflict, rejected because each one is cheap to reverse.
