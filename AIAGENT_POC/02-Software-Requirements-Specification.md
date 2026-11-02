# Software Requirements Specification (SRS)

## Content Management System (CMS) — MVP

| Field             | Value                                       |
| ----------------- | ------------------------------------------- |
| Document Type     | Software Requirements Specification (SRS)   |
| Document Version  | 1.0                                         |
| Status            | Draft                                       |
| Date              | 2026-05-11                                  |
| Classification    | Internal                                    |
| Standard Followed | IEEE 830-1998 / ISO/IEC/IEEE 29148:2018     |
| Companion Doc     | 01-Requirements-Specification.md            |

---

## Table of Contents

1. Introduction
2. Overall Description
3. System Architecture (Logical)
4. External Interface Requirements
5. Functional Requirements
6. Data Requirements
7. API Specification (Summary)
8. Non-Functional Requirements
9. Security Requirements
10. Other Requirements
11. Acceptance Criteria & Traceability
12. Appendices

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) describes the functional and non-functional requirements for the **CMS MVP**. It is intended for:

- **Developers** implementing the system.
- **QA engineers** designing test cases.
- **DevOps engineers** provisioning infrastructure.
- **Security reviewers** validating controls.
- **Product owners** verifying scope coverage.

This SRS is the authoritative specification. Where it conflicts with informal communication, this document prevails until formally amended.

### 1.2 Document Conventions

- **SHALL** indicates a mandatory requirement.
- **SHOULD** indicates a recommended requirement.
- **MAY** indicates an optional requirement.
- Functional requirements are prefixed **FR-** and grouped by module.
- Non-functional requirements are prefixed **NFR-**.
- Each requirement is uniquely numbered and traceable to a business or user requirement.

### 1.3 Intended Audience and Reading Order

| Audience               | Recommended Sections        |
| ---------------------- | --------------------------- |
| Product Owner          | 1, 2, 5, 11                 |
| Developer              | 2, 3, 4, 5, 6, 7, 9         |
| QA Engineer            | 5, 6, 8, 9, 11              |
| DevOps                 | 3, 4, 8, 9                  |
| Security Reviewer      | 4, 6, 9                     |

### 1.4 Project Scope

See companion document `01-Requirements-Specification.md` Section 1.2. This SRS does not redefine scope; it specifies *how* the in-scope features behave.

---

## 2. Overall Description

### 2.1 Product Perspective

The CMS is a **new, standalone web application**. It does not replace an existing system but consolidates ad-hoc content workflows currently handled via direct code edits and manual uploads.

It operates as a **headless CMS** with an attached admin SPA:

- **Admin SPA** — Browser application used by internal staff.
- **Admin API** — Authenticated REST API serving the SPA.
- **Public API** — Read-only REST API for external frontend consumers.
- **Application Server** — Hosts business logic and serves both APIs.
- **Database** — Persists content, users, and audit logs.
- **Object Storage** — Persists media binaries.
- **Email Service** — External SaaS for transactional email.

### 2.2 Product Functions (High Level)

1. Authenticate and authorize users.
2. Manage user accounts and roles.
3. Create, edit, review, schedule, publish, and unpublish content.
4. Upload, browse, and reference media assets.
5. Expose published content via a public REST API.
6. Maintain an audit log of significant actions.

### 2.3 User Classes and Characteristics

| Class    | Frequency       | Technical Skill | Privilege         |
| -------- | --------------- | --------------- | ----------------- |
| Admin    | Weekly          | Medium          | Full              |
| Editor   | Daily           | Low–Medium      | Content + Media   |
| Author   | Daily           | Low             | Own content only  |
| API User | Continuous (programmatic) | High  | Read published   |

### 2.4 Operating Environment

- **Server runtime**: Linux containers (Docker), orchestrated via Kubernetes or equivalent.
- **Database**: PostgreSQL 15+ (or compatible managed service).
- **Object storage**: S3-compatible (AWS S3, Azure Blob with S3 gateway, or MinIO for dev).
- **Cache (optional)**: Redis for session and response caching.
- **Browsers (admin)**: Latest 2 versions of Chrome, Edge, Safari, Firefox. Minimum viewport 1280×800.

### 2.5 Design and Implementation Constraints

- Backend language and framework are not mandated by this SRS, but the team SHALL choose a stack with active LTS support and an ecosystem covering ORM, validation, and OpenAPI generation.
- Frontend SHALL be a SPA (React, Vue, or Svelte). Server-side rendering is not required for the admin UI.
- All inter-service communication SHALL use HTTPS in non-local environments.
- Database schema SHALL be managed via versioned migrations.
- Configuration SHALL be externalized (environment variables or a secrets manager); no secrets in source control.

### 2.6 Assumptions and Dependencies

Listed in the companion Requirements doc, Section 8.

---

## 3. System Architecture (Logical)

### 3.1 Component Diagram (Textual)

```
┌────────────────────────┐         ┌─────────────────────────┐
│   Admin SPA (Browser)  │ ──────▶ │   Admin API (HTTPS/JWT) │
└────────────────────────┘         └──────────┬──────────────┘
                                              │
┌────────────────────────┐         ┌──────────▼──────────────┐
│  Public Frontend(s)    │ ──────▶ │  Public API (HTTPS/API  │
│  (web/mobile/3rd-party)│         │  key, read-only)        │
└────────────────────────┘         └──────────┬──────────────┘
                                              │
                                   ┌──────────▼──────────────┐
                                   │   Application Server     │
                                   │   (Business Logic)       │
                                   └──┬─────────┬─────────┬───┘
                                      │         │         │
                            ┌─────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
                            │ PostgreSQL │ │  Redis  │ │ Object Store│
                            │ (primary)  │ │ (cache) │ │ (media)     │
                            └────────────┘ └─────────┘ └──┬──────────┘
                                                          │
                                                ┌─────────▼─────────┐
                                                │  CDN (optional)   │
                                                └───────────────────┘
                                              │
                                   ┌──────────▼──────────────┐
                                   │  Email Service (SaaS)    │
                                   └─────────────────────────┘
```

### 3.2 Deployment View

- Application server runs as a stateless containerized service behind a load balancer.
- Database, cache, and object storage are managed services where possible.
- A single environment per stage: **dev**, **staging**, **production**.
- Blue/green or rolling deployments. Database migrations run as a pre-deploy step.

### 3.3 Module Decomposition

| Module           | Responsibility                                                    |
| ---------------- | ----------------------------------------------------------------- |
| Auth             | Login, password reset, JWT issuance, session lifecycle            |
| Users            | User CRUD, role assignment                                        |
| Content          | Article and Page CRUD, lifecycle, scheduling                      |
| Media            | Upload pipeline, library, references                              |
| Audit            | Append-only event log                                             |
| Public API       | Read-only endpoints with caching and projection                   |
| Admin API        | Authenticated CRUD endpoints used by the SPA                      |
| Notifications    | Email dispatch for invites, password resets, review notifications |

---

## 4. External Interface Requirements

### 4.1 User Interfaces

The Admin SPA SHALL provide, at minimum:

| Screen / View          | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| Login                  | Email + password authentication                                      |
| Forgot Password        | Initiate password reset email                                        |
| Reset Password         | Set a new password via emailed link                                  |
| Dashboard              | At-a-glance content counts, recent activity                          |
| Content List           | Filter by type, status, author, date; pagination; search by title    |
| Content Editor         | Create / edit / submit / publish a content item                      |
| Media Library          | Grid of media; upload; search by filename / alt text; delete         |
| Users                  | List, invite, edit, deactivate; assign roles (Admin only)            |
| Audit Log              | Filterable, paginated log view (Admin only)                          |
| Profile                | Change own password, view own account info                           |

UI requirements:

- The UI SHALL be responsive for viewports ≥ 1024px wide. Mobile is out of scope for admin.
- The UI SHALL show inline validation errors next to invalid fields.
- The UI SHALL show toast notifications for success and error of asynchronous actions.
- The UI SHALL show loading states for any action exceeding 300 ms.
- The UI SHALL prevent accidental data loss via an unsaved-changes prompt on navigation.

### 4.2 Software Interfaces

| Interface         | Protocol  | Auth         | Purpose                              |
| ----------------- | --------- | ------------ | ------------------------------------ |
| Admin API         | HTTPS/JSON | JWT (Bearer) | Used by the SPA                      |
| Public API        | HTTPS/JSON | API key      | Used by external frontends           |
| Object Storage    | HTTPS/S3 API | IAM        | Direct upload (presigned URLs)       |
| Email Service     | HTTPS/SMTP or API | API key | Transactional emails           |
| Database          | TCP / TLS | DB credentials | Internal only                      |

### 4.3 Communications Interfaces

- All external traffic SHALL use TLS 1.2 or higher.
- The API SHALL respond with `application/json; charset=utf-8`.
- The API SHALL support CORS for configured origins on public endpoints.

---

## 5. Functional Requirements

### 5.1 Authentication (FR-AUTH)

| ID         | Requirement                                                                                                                                                  | Traces to |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-AUTH-01 | The system SHALL authenticate users via email and password.                                                                                                  | BR-05     |
| FR-AUTH-02 | The system SHALL enforce passwords of minimum length 12 characters, containing at least one letter and one digit.                                            | CN-04     |
| FR-AUTH-03 | Passwords SHALL be hashed using Argon2id (preferred) or bcrypt with cost ≥ 12. Plaintext passwords SHALL never be logged or stored.                          | CN-04     |
| FR-AUTH-04 | Upon successful login, the system SHALL issue a JWT access token (TTL ≤ 60 minutes) and a refresh token (TTL ≤ 14 days).                                     | BR-08     |
| FR-AUTH-05 | The system SHALL invalidate refresh tokens upon password change, user deactivation, or explicit logout.                                                      | BR-08     |
| FR-AUTH-06 | The system SHALL lock an account for 15 minutes after 5 failed login attempts within 10 minutes. Locked accounts SHALL not reveal lockout state to the client beyond a generic message. | BR-08 |
| FR-AUTH-07 | The system SHALL provide a password reset flow via emailed one-time link valid for 60 minutes.                                                               | UR-A05    |
| FR-AUTH-08 | Password reset links SHALL be single-use and SHALL be invalidated after first successful use or expiry.                                                      | BR-08     |
| FR-AUTH-09 | The system SHALL allow users to log out, which SHALL invalidate the current refresh token server-side.                                                       | BR-08     |
| FR-AUTH-10 | Failed login attempts and successful logins SHALL be written to the audit log.                                                                               | BR-03     |

### 5.2 User Management (FR-USER)

| ID         | Requirement                                                                                                                                                  | Traces to |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-USER-01 | Only users with the **Admin** role SHALL create, edit, deactivate, or delete user accounts.                                                                  | UR-A01..3 |
| FR-USER-02 | The system SHALL invite users by email. The invite SHALL contain a one-time link to set the initial password (valid 7 days).                                 | UR-A01    |
| FR-USER-03 | Each user SHALL have exactly one role: **Admin**, **Editor**, or **Author**.                                                                                 | BR-05     |
| FR-USER-04 | The system SHALL prevent deletion of the last remaining Admin account.                                                                                       | BR-05     |
| FR-USER-05 | Deactivated users SHALL be denied login immediately. Their authored content SHALL remain intact with author attribution preserved.                           | UR-A03    |
| FR-USER-06 | The system SHALL display a list of users with name, email, role, status, and last login.                                                                     | UR-A02    |
| FR-USER-07 | Email addresses SHALL be unique system-wide and validated for RFC 5322 conformance.                                                                          | —         |
| FR-USER-08 | All user mutation actions SHALL be written to the audit log with the acting Admin's identity.                                                                | BR-03     |

### 5.3 Authorization (FR-AUTHZ)

| ID          | Requirement                                                                                                                                                  | Traces to |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-AUTHZ-01 | The system SHALL enforce the permission matrix in Section 5.3.1 on every protected endpoint, both at the route layer and at the data access layer.           | BR-08     |
| FR-AUTHZ-02 | Authors SHALL only create, view, edit, and submit **their own** content. They SHALL NOT see drafts of other authors.                                         | UR-U01..3 |
| FR-AUTHZ-03 | Editors SHALL view, edit, publish, and unpublish **all** content regardless of author.                                                                       | UR-E01..3 |
| FR-AUTHZ-04 | Admins SHALL have all Editor permissions plus user and audit log management.                                                                                 | UR-A01..5 |
| FR-AUTHZ-05 | Unauthorized requests SHALL return HTTP 403 with a generic error body. Unauthenticated requests SHALL return HTTP 401.                                       | BR-08     |
| FR-AUTHZ-06 | The public API SHALL only expose content with status = **Published** and `published_at` ≤ current time.                                                      | RK-04     |

#### 5.3.1 Permission Matrix

| Capability                    | Admin | Editor | Author          | Public API |
| ----------------------------- | :---: | :----: | :-------------: | :--------: |
| Create content                |   ✓   |   ✓    | ✓               |            |
| Edit own content              |   ✓   |   ✓    | ✓               |            |
| Edit others' content          |   ✓   |   ✓    |                 |            |
| Submit for review             |   ✓   |   ✓    | ✓               |            |
| Publish / Unpublish           |   ✓   |   ✓    |                 |            |
| Schedule publish              |   ✓   |   ✓    |                 |            |
| Delete content                |   ✓   |   ✓    |                 |            |
| Upload media                  |   ✓   |   ✓    | ✓               |            |
| Delete media                  |   ✓   |   ✓    | own only        |            |
| Manage users                  |   ✓   |        |                 |            |
| View audit log                |   ✓   |        |                 |            |
| Read published content        |   ✓   |   ✓    | ✓               | ✓          |
| Read drafts                   |   ✓   |   ✓    | own only        |            |

### 5.4 Content Management (FR-CONTENT)

#### 5.4.1 Lifecycle

States and allowed transitions:

```
   ┌────────┐  submit   ┌───────────┐  approve  ┌────────────┐
   │ Draft  │──────────▶│ In Review │──────────▶│ Published  │
   └────────┘           └───────────┘           └────┬───────┘
       ▲   ▲                  │                      │
       │   │ reject           │                      │ unpublish
       │   └──────────────────┘                      ▼
       │                                       ┌────────────┐
       └─────────────── edit ──────────────────│Unpublished │
                                                └─────┬──────┘
                                                      │ archive
                                                      ▼
                                                ┌────────────┐
                                                │  Archived  │
                                                └────────────┘
```

| ID            | Requirement                                                                                                                                                  | Traces to |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-CONTENT-01 | The system SHALL support content types **Article** and **Page** as defined in the Requirements doc Section 6.2.                                              | BR-01     |
| FR-CONTENT-02 | Every content item SHALL have a unique, URL-safe slug per content type. Slugs SHALL be auto-generated from the title on first save and editable thereafter.  | UR-U06    |
| FR-CONTENT-03 | The system SHALL prevent slug collisions within a content type and return a validation error on conflict.                                                    | —         |
| FR-CONTENT-04 | Content SHALL transition only along the lifecycle in 5.4.1. Invalid transitions SHALL return HTTP 409.                                                       | BR-02     |
| FR-CONTENT-05 | A content item SHALL be saveable as Draft with only **Title** populated. All other fields are optional in Draft state.                                       | UR-U01    |
| FR-CONTENT-06 | Publishing SHALL require: non-empty Title, non-empty Body, valid Slug, and a non-empty SEO meta description (≤ 160 chars).                                   | BR-01     |
| FR-CONTENT-07 | The system SHALL support **Scheduled Publish** by setting `scheduled_at` to a future timestamp. A background job SHALL transition the item to Published at that time. | UR-E02 |
| FR-CONTENT-08 | The system SHALL retain version history on every save. Each version SHALL record the editor, timestamp, and a full snapshot of the content.                  | UR-A04    |
| FR-CONTENT-09 | Users SHALL be able to revert a content item to any prior version. Reverting SHALL create a new version (no destructive overwrite).                          | UR-A04    |
| FR-CONTENT-10 | The system SHALL support listing content with filters: status, type, author, tag (Articles only), date range. Pagination SHALL default to 25 per page, max 100. | UR-E05  |
| FR-CONTENT-11 | The system SHALL provide a search-by-title (case-insensitive, partial match) on the content list.                                                             | UR-E05    |
| FR-CONTENT-12 | Unpublishing SHALL remove the item from the public API within 60 seconds (accounting for cache TTL).                                                          | BR-02     |
| FR-CONTENT-13 | Deletion SHALL be a soft delete (mark as deleted, retain for 30 days, then hard delete via a scheduled job).                                                  | BR-03     |
| FR-CONTENT-14 | Rich text Body SHALL be stored in a structured format (e.g., HTML sanitized via an allow-list, or a portable JSON tree such as ProseMirror nodes).            | RK-02     |
| FR-CONTENT-15 | The rich text editor SHALL support: headings (H2–H4), bold, italic, lists (ordered/unordered), links, blockquotes, code blocks, inline images, horizontal rule. | UR-U02 |
| FR-CONTENT-16 | All content mutation actions SHALL be written to the audit log.                                                                                              | BR-03     |

### 5.5 Media Management (FR-MEDIA)

| ID          | Requirement                                                                                                                                                  | Traces to |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-MEDIA-01 | The system SHALL support uploading the following types: PNG, JPEG, WEBP, GIF, SVG, PDF.                                                                      | UR-U05    |
| FR-MEDIA-02 | Maximum file size SHALL be 20 MB per file. The limit SHALL be configurable.                                                                                  | RK-03     |
| FR-MEDIA-03 | The system SHALL reject uploads whose MIME type, declared extension, and detected magic bytes do not all match the allow-list.                               | BR-08     |
| FR-MEDIA-04 | Uploads SHALL use presigned URLs to upload directly to object storage. The application server SHALL NOT proxy the binary payload.                            | NFR-PERF  |
| FR-MEDIA-05 | The system SHALL generate and store at least two responsive variants per image (thumbnail ≤ 320px, medium ≤ 1024px) in addition to the original.             | UR-D03    |
| FR-MEDIA-06 | Each media item SHALL have editable fields: filename (read-only), alt text, caption, uploaded_by, uploaded_at, size, mime_type.                              | UR-E04    |
| FR-MEDIA-07 | The system SHALL prevent deletion of a media item that is currently referenced by any non-deleted content item. A force-delete option SHALL be available to Admins. | UR-E04 |
| FR-MEDIA-08 | The media library SHALL support filename search and filter by uploader and date range.                                                                       | UR-E04    |

### 5.6 SEO (FR-SEO)

| ID        | Requirement                                                                                                                                                  | Traces to |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-SEO-01 | Each content item SHALL have: SEO Title (≤ 70 chars), Meta Description (≤ 160 chars), Slug, Social Share Image (media reference).                            | UR-U06    |
| FR-SEO-02 | The system SHALL default SEO Title to the content Title and Meta Description to the first 160 characters of body text, both overridable.                     | UR-U06    |
| FR-SEO-03 | The public API SHALL include all SEO fields in single-item responses.                                                                                        | UR-D03    |

### 5.7 Audit Log (FR-AUDIT)

| ID          | Requirement                                                                                                                                                  | Traces to |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-AUDIT-01 | The system SHALL record audit events with: event id, timestamp (UTC), actor user id, actor IP, action, target type, target id, summary of change.            | BR-03     |
| FR-AUDIT-02 | Audited actions SHALL include at minimum: user login (success/fail), logout, user create/update/deactivate, content create/update/state-change/delete, media upload/delete. | BR-03 |
| FR-AUDIT-03 | The audit log SHALL be append-only. The system SHALL NOT expose any API or UI to modify or delete audit records.                                             | BR-03     |
| FR-AUDIT-04 | The audit log SHALL be retained for at least 365 days.                                                                                                       | BR-03     |
| FR-AUDIT-05 | Admins SHALL be able to view the audit log filtered by actor, action, target, and date range.                                                                | UR-A04    |
| FR-AUDIT-06 | The audit log UI SHALL be paginated and exportable as CSV (Admin only).                                                                                      | UR-A04    |

### 5.8 Public API (FR-PUBAPI)

| ID           | Requirement                                                                                                                                                  | Traces to |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-PUBAPI-01 | The public API SHALL expose endpoints listed in Section 7. It SHALL be read-only.                                                                            | BR-04     |
| FR-PUBAPI-02 | Authentication SHALL be via an API key passed in the `X-API-Key` header. Keys SHALL be issuable, listable, and revocable by Admins.                          | UR-D04    |
| FR-PUBAPI-03 | The public API SHALL only return content items with status = Published and `published_at` ≤ now (UTC).                                                       | FR-AUTHZ-06 |
| FR-PUBAPI-04 | Responses SHALL include cache headers (`Cache-Control`, `ETag`, `Last-Modified`).                                                                            | NFR-PERF-02 |
| FR-PUBAPI-05 | The API SHALL support pagination via `page` and `page_size` query parameters (default 25, max 100). Responses SHALL include `total`, `page`, `page_size`, and `total_pages`. | UR-D01 |
| FR-PUBAPI-06 | Errors SHALL follow a consistent shape: `{ "error": { "code": string, "message": string, "details": object? } }`.                                            | UR-D05    |
| FR-PUBAPI-07 | An OpenAPI 3.1 specification SHALL be published and kept in sync with the implementation. A Swagger / Redoc viewer SHALL be available at `/docs`.            | UR-D05    |

---

## 6. Data Requirements

### 6.1 Entity Overview

```
User ─┬─< AuditEvent
      │
      ├─< Content (author)
      │
      └─< MediaItem (uploaded_by)

Content ─┬─< ContentVersion
         ├─── MediaItem (featured_image, social_image)
         └─< ContentMediaRef (embedded media usages)
```

### 6.2 Entities and Key Attributes

#### User

| Field             | Type      | Constraints                          |
| ----------------- | --------- | ------------------------------------ |
| id                | UUID      | PK                                   |
| email             | string    | unique, RFC 5322                     |
| name              | string    | required                             |
| password_hash     | string    | Argon2id/bcrypt                      |
| role              | enum      | admin / editor / author              |
| status            | enum      | active / deactivated / invited       |
| last_login_at     | timestamp | nullable                             |
| created_at        | timestamp |                                      |
| updated_at        | timestamp |                                      |

#### Content

| Field              | Type      | Constraints                            |
| ------------------ | --------- | -------------------------------------- |
| id                 | UUID      | PK                                     |
| type               | enum      | article / page                         |
| title              | string    | required, ≤ 200                        |
| slug               | string    | required, unique per type, URL-safe    |
| body               | jsonb     | structured rich text                   |
| status             | enum      | draft / in_review / published / unpublished / archived |
| author_id          | UUID      | FK → User                              |
| featured_image_id  | UUID      | FK → MediaItem (nullable)              |
| social_image_id    | UUID      | FK → MediaItem (nullable)              |
| seo_title          | string    | ≤ 70                                   |
| seo_description    | string    | ≤ 160                                  |
| tags               | string[]  | Articles only                          |
| category           | string    | Articles only, nullable                |
| parent_id          | UUID      | Pages only, FK → Content, nullable     |
| scheduled_at       | timestamp | nullable                               |
| published_at       | timestamp | nullable, set on first publish         |
| deleted_at         | timestamp | nullable (soft delete)                 |
| created_at         | timestamp |                                        |
| updated_at         | timestamp |                                        |

Indexes:

- `(type, slug)` unique
- `(status, published_at desc)` for public list queries
- `(author_id, status)` for Author list queries
- `tags` GIN index (Articles)

#### ContentVersion

| Field         | Type      | Notes                                  |
| ------------- | --------- | -------------------------------------- |
| id            | UUID      | PK                                     |
| content_id    | UUID      | FK → Content                           |
| version_no    | int       | monotonically increasing per content   |
| snapshot      | jsonb     | full content state at save time        |
| editor_id     | UUID      | FK → User                              |
| created_at    | timestamp |                                        |

#### MediaItem

| Field         | Type      | Notes                                  |
| ------------- | --------- | -------------------------------------- |
| id            | UUID      | PK                                     |
| storage_key   | string    | object storage key                     |
| filename      | string    |                                        |
| mime_type     | string    |                                        |
| size_bytes    | bigint    |                                        |
| width         | int       | nullable (images only)                 |
| height        | int       | nullable (images only)                 |
| alt_text      | string    | nullable                               |
| caption       | string    | nullable                               |
| variants      | jsonb     | { thumbnail: {key,w,h}, medium: {...} }|
| uploaded_by   | UUID      | FK → User                              |
| created_at    | timestamp |                                        |

#### ApiKey

| Field         | Type      | Notes                                  |
| ------------- | --------- | -------------------------------------- |
| id            | UUID      | PK                                     |
| name          | string    | human-readable label                   |
| key_hash      | string    | hash of the issued key (never store raw) |
| last_used_at  | timestamp | nullable                               |
| revoked_at    | timestamp | nullable                               |
| created_by    | UUID      | FK → User                              |
| created_at    | timestamp |                                        |

#### AuditEvent

| Field         | Type      | Notes                                  |
| ------------- | --------- | -------------------------------------- |
| id            | UUID      | PK                                     |
| occurred_at   | timestamp | UTC                                    |
| actor_id      | UUID      | FK → User, nullable (system events)    |
| actor_ip      | string    | IPv4/IPv6                              |
| action        | string    | e.g. `content.publish`                 |
| target_type   | string    | e.g. `content`, `user`                 |
| target_id     | UUID      | nullable                               |
| summary       | jsonb     | diff or context                        |

### 6.3 Data Volume Estimates (MVP Year 1)

| Entity          | Rows (est.) |
| --------------- | ----------- |
| Users           | < 500       |
| Content         | < 10,000    |
| ContentVersion  | < 100,000   |
| MediaItem       | < 50,000    |
| AuditEvent      | < 5,000,000 |

### 6.4 Data Retention

| Data           | Retention                          |
| -------------- | ---------------------------------- |
| Active content | Indefinite                         |
| Soft-deleted content | 30 days, then hard-deleted   |
| Content versions | Last 50 per item, then prune oldest |
| Audit log      | 365 days minimum                   |
| Deactivated users | Indefinite (for attribution)    |
| Media          | Indefinite while referenced; orphan media is reviewed quarterly |

---

## 7. API Specification (Summary)

Full OpenAPI 3.1 spec is maintained separately. The following table summarizes endpoints.

### 7.1 Admin API (Auth: Bearer JWT)

| Method | Path                              | Purpose                              |
| ------ | --------------------------------- | ------------------------------------ |
| POST   | `/api/admin/auth/login`           | Email + password → tokens            |
| POST   | `/api/admin/auth/refresh`         | Exchange refresh for new access token |
| POST   | `/api/admin/auth/logout`          | Invalidate current refresh token     |
| POST   | `/api/admin/auth/password/forgot` | Initiate reset email                 |
| POST   | `/api/admin/auth/password/reset`  | Submit new password with token       |
| GET    | `/api/admin/users`                | List users (Admin)                   |
| POST   | `/api/admin/users`                | Invite user (Admin)                  |
| PATCH  | `/api/admin/users/{id}`           | Update user (Admin)                  |
| POST   | `/api/admin/users/{id}/deactivate`| Deactivate user (Admin)              |
| GET    | `/api/admin/content`              | List content (filters, pagination)   |
| POST   | `/api/admin/content`              | Create content                       |
| GET    | `/api/admin/content/{id}`         | Get content                          |
| PATCH  | `/api/admin/content/{id}`         | Update content                       |
| POST   | `/api/admin/content/{id}/submit`  | Submit for review                    |
| POST   | `/api/admin/content/{id}/publish` | Publish (Editor/Admin)               |
| POST   | `/api/admin/content/{id}/unpublish`| Unpublish (Editor/Admin)            |
| POST   | `/api/admin/content/{id}/schedule`| Schedule publish                     |
| DELETE | `/api/admin/content/{id}`         | Soft delete                          |
| GET    | `/api/admin/content/{id}/versions`| List versions                        |
| POST   | `/api/admin/content/{id}/revert/{version}` | Revert to a version          |
| POST   | `/api/admin/media/presign`        | Get presigned upload URL             |
| POST   | `/api/admin/media`                | Finalize media metadata after upload |
| GET    | `/api/admin/media`                | List media                           |
| PATCH  | `/api/admin/media/{id}`           | Update metadata                      |
| DELETE | `/api/admin/media/{id}`           | Delete media                         |
| GET    | `/api/admin/audit`                | List audit events (Admin)            |
| GET    | `/api/admin/audit/export.csv`     | Export audit (Admin)                 |
| GET    | `/api/admin/api-keys`             | List API keys (Admin)                |
| POST   | `/api/admin/api-keys`             | Create API key (returned once)       |
| DELETE | `/api/admin/api-keys/{id}`        | Revoke API key                       |

### 7.2 Public API (Auth: `X-API-Key` header)

| Method | Path                              | Purpose                              |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/api/v1/articles`                | List published articles              |
| GET    | `/api/v1/articles/{slug}`         | Get one article by slug              |
| GET    | `/api/v1/pages`                   | List published pages                 |
| GET    | `/api/v1/pages/{slug}`            | Get one page by slug                 |
| GET    | `/api/v1/media/{id}`              | Get media metadata + URLs (variants) |

### 7.3 Standard Response Envelope (Lists)

```json
{
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total": 137,
    "total_pages": 6
  }
}
```

### 7.4 Standard Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Slug already exists for this content type",
    "details": { "field": "slug" }
  }
}
```

### 7.5 Status Codes

| Code | Meaning                                          |
| ---- | ------------------------------------------------ |
| 200  | Success                                          |
| 201  | Created                                          |
| 204  | Deleted / no content                             |
| 400  | Bad request (malformed)                          |
| 401  | Unauthenticated                                  |
| 403  | Forbidden                                        |
| 404  | Not found                                        |
| 409  | Conflict (slug collision, invalid state transition) |
| 422  | Validation error                                 |
| 429  | Rate limit exceeded                              |
| 500  | Internal error                                   |

---

## 8. Non-Functional Requirements

### 8.1 Performance (NFR-PERF)

| ID          | Requirement                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| NFR-PERF-01 | Admin SPA initial load (P95) SHALL be ≤ 2.5 s on a 10 Mbps connection.                                       |
| NFR-PERF-02 | Public API (cached) SHALL respond within 200 ms P95 under 50 RPS sustained load.                             |
| NFR-PERF-03 | Public API (uncached) SHALL respond within 600 ms P95 under 50 RPS sustained load.                           |
| NFR-PERF-04 | Admin API mutation endpoints SHALL respond within 800 ms P95.                                                |
| NFR-PERF-05 | Media upload SHALL not pass through the application server (presigned URLs to object storage).               |
| NFR-PERF-06 | The system SHALL serve at least 200 concurrent public API consumers without degradation.                     |

### 8.2 Scalability (NFR-SCAL)

| ID          | Requirement                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| NFR-SCAL-01 | The application server SHALL be horizontally scalable (stateless).                                           |
| NFR-SCAL-02 | The system SHALL support adding read replicas to the database without code changes.                          |
| NFR-SCAL-03 | The system SHALL be designed to handle 10× MVP data volume (100k content items, 50M audit rows) with infra scaling only. |

### 8.3 Availability and Reliability (NFR-AVAIL)

| ID           | Requirement                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| NFR-AVAIL-01 | Production uptime SHALL be ≥ 99.5% measured monthly (admin + public API combined).                           |
| NFR-AVAIL-02 | RPO ≤ 1 hour. Database backups SHALL be taken at least hourly.                                               |
| NFR-AVAIL-03 | RTO ≤ 4 hours for full production restore.                                                                   |
| NFR-AVAIL-04 | Deployments SHALL be zero-downtime (rolling or blue/green).                                                  |
| NFR-AVAIL-05 | The system SHALL implement health and readiness probes for orchestrator integration.                         |

### 8.4 Usability (NFR-USE)

| ID         | Requirement                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| NFR-USE-01 | A new Editor SHALL be able to create and publish content within 30 minutes after a 1-hour onboarding.        |
| NFR-USE-02 | All destructive actions (delete, unpublish) SHALL require confirmation.                                      |
| NFR-USE-03 | The UI SHALL meet WCAG 2.1 Level AA for color contrast, keyboard navigation, and form labels.                |
| NFR-USE-04 | The UI SHALL show clear feedback within 300 ms for any user-initiated action.                                |

### 8.5 Maintainability (NFR-MAIN)

| ID          | Requirement                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| NFR-MAIN-01 | Unit test coverage SHALL be ≥ 70% on business logic modules.                                                 |
| NFR-MAIN-02 | The codebase SHALL pass linting and type-checking in CI as a merge prerequisite.                             |
| NFR-MAIN-03 | All database changes SHALL be performed via versioned, reversible migrations.                                |
| NFR-MAIN-04 | Configuration SHALL be externalized; secrets SHALL come from a secrets manager.                              |

### 8.6 Portability (NFR-PORT)

| ID          | Requirement                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| NFR-PORT-01 | The system SHALL run on any Linux container host without source modification.                                |
| NFR-PORT-02 | Object storage access SHALL use the S3 API to remain portable across AWS S3, MinIO, and Azure equivalents.   |

### 8.7 Observability (NFR-OBS)

| ID         | Requirement                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| NFR-OBS-01 | The application SHALL emit structured JSON logs including request id, user id (if authenticated), and latency. |
| NFR-OBS-02 | The application SHALL expose Prometheus-compatible metrics: request count, error rate, latency histograms, by route. |
| NFR-OBS-03 | The application SHALL support distributed tracing via OpenTelemetry.                                         |
| NFR-OBS-04 | Errors at 5xx SHALL be reported to an error tracking service (e.g., Sentry).                                 |

### 8.8 Internationalization (NFR-I18N)

| ID          | Requirement                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| NFR-I18N-01 | All persisted strings SHALL be stored as UTF-8.                                                              |
| NFR-I18N-02 | Date/time values SHALL be stored in UTC and rendered in the user's local timezone in the UI.                 |
| NFR-I18N-03 | UI text SHALL be externalized in resource files to enable future localization (no inline string literals).   |

---

## 9. Security Requirements

| ID         | Requirement                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01     | All traffic to and from the system SHALL use TLS 1.2 or higher.                                                                                                |
| SEC-02     | The application SHALL set baseline HTTP security headers: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`. |
| SEC-03     | The application SHALL be protected against the OWASP Top 10 (2021) classes: injection, broken auth, sensitive data exposure, XXE, broken access control, security misconfiguration, XSS, insecure deserialization, vulnerable components, insufficient logging. |
| SEC-04     | All user-supplied rich text SHALL be sanitized server-side against an allow-list before storage; client-side sanitization is not sufficient.                    |
| SEC-05     | Uploaded files SHALL be scanned for MIME/extension/magic-byte consistency. SVG files SHALL be sanitized (script and external reference stripping) before storage. |
| SEC-06     | Object storage SHALL be configured to deny public listing. Media SHALL be served via signed URLs or CDN with a configured origin policy.                       |
| SEC-07     | Rate limiting SHALL be applied to: login (10/min/IP), password reset (5/hr/IP), public API (configurable, default 60/min/key).                                  |
| SEC-08     | Dependencies SHALL be scanned in CI for known vulnerabilities (e.g., npm audit, Snyk, Dependabot).                                                              |
| SEC-09     | Secrets SHALL never be committed. CI SHALL fail on detected secrets (e.g., gitleaks).                                                                          |
| SEC-10     | Database credentials and API keys SHALL be rotatable without code deploy.                                                                                       |
| SEC-11     | The system SHALL implement CSRF protection on all state-changing admin endpoints if cookie-based auth is used. (Not required for header-based JWT.)             |
| SEC-12     | Admin sessions SHALL idle-expire after 30 minutes of inactivity (access token TTL aligned).                                                                     |
| SEC-13     | Audit logs SHALL be tamper-evident: write-once at the application layer; periodic checksum or external log shipping recommended.                                |
| SEC-14     | PII exposure in logs SHALL be limited to user id; email and IP SHALL be redacted in non-security logs.                                                          |
| SEC-15     | A security review SHALL be conducted before production launch covering authentication, authorization, input handling, and dependency posture.                   |

---

## 10. Other Requirements

### 10.1 Legal and Compliance

- The system SHALL display a privacy notice to all admin users on first login.
- All collected data SHALL be deletable on request to support data subject rights (where applicable under local data protection law).

### 10.2 Documentation

- A user guide for Admin, Editor, and Author SHALL be delivered with the MVP.
- An operations runbook (deploy, backup, restore, incident triage) SHALL be delivered with the MVP.
- The OpenAPI spec SHALL be published and versioned alongside releases.

### 10.3 Environments

| Environment | Purpose                              | Data         |
| ----------- | ------------------------------------ | ------------ |
| Local       | Developer machines                   | Synthetic    |
| Dev         | Continuous integration               | Synthetic    |
| Staging     | Pre-production, UAT                  | Sanitized    |
| Production  | Live                                 | Real         |

### 10.4 Release Strategy

- MVP SHALL be released as version `1.0.0`.
- Semantic Versioning SHALL apply (`MAJOR.MINOR.PATCH`).
- The public API SHALL be versioned via URL path (`/api/v1/...`). Breaking changes require a new major version.

---

## 11. Acceptance Criteria & Traceability

### 11.1 Definition of Done (per feature)

A feature is "done" when:

1. Functional requirements are implemented and pass all defined acceptance tests.
2. Unit tests cover ≥ 70% of new business logic.
3. At least one end-to-end test exercises the primary happy path through the API.
4. Authorization is enforced at both the route and data access layers (verified by tests).
5. The OpenAPI spec is updated.
6. Documentation (user guide section or operations note) is updated.
7. Audit log writes are verified.
8. Code review approved and CI green.

### 11.2 Sample Acceptance Tests

| FR Tested        | Test                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| FR-AUTH-06       | After 5 failed logins within 10 min, the 6th attempt with correct password is rejected. After 15 min, login succeeds.                    |
| FR-AUTHZ-02      | An Author requesting `GET /api/admin/content` sees only items where `author_id` matches their own user id, regardless of query params.   |
| FR-AUTHZ-06      | A `Draft` article is not returned from `GET /api/v1/articles` nor `GET /api/v1/articles/{slug}` even with valid API key.                 |
| FR-CONTENT-04    | Attempting to publish from `Draft` directly (skipping submit/review) is allowed for Editors, denied for Authors. Wrong transitions for any role return 409. |
| FR-CONTENT-07    | Setting `scheduled_at = now + 5 min` on an item in `In Review` transitions it to `Published` within 60 s of the scheduled time.          |
| FR-CONTENT-12    | After unpublishing, the item disappears from `/api/v1/articles` within 60 s. ETag of list endpoint changes.                              |
| FR-MEDIA-07      | Deleting a media item referenced by a published article returns 409 with an explanatory error.                                           |
| FR-AUDIT-03      | No HTTP method on `/api/admin/audit/{id}` accepts mutations. Database role for the app SHALL NOT have UPDATE/DELETE on the audit table.  |
| SEC-04           | A POST of content body containing `<script>alert(1)</script>` is stored sanitized; the public API never returns executable script tags.  |

### 11.3 Traceability Matrix (Selected)

| Business / User Req | Implemented By                          | Verified By                              |
| ------------------- | --------------------------------------- | ---------------------------------------- |
| BR-01               | FR-CONTENT-01..16, FR-MEDIA-*           | Acceptance tests on Content + Media      |
| BR-02               | FR-CONTENT-04, FR-CONTENT-06, FR-AUTHZ-06 | End-to-end lifecycle tests             |
| BR-03               | FR-AUDIT-01..06, SEC-13                 | Audit integration tests, manual review   |
| BR-04               | FR-PUBAPI-01..07                        | API contract tests against OpenAPI       |
| BR-05               | FR-USER-*, FR-AUTHZ-* + matrix          | RBAC test matrix per endpoint            |
| BR-08               | SEC-01..15, FR-AUTH-*                   | Security review, dependency scans, pen test |
| UR-D05              | FR-PUBAPI-07                            | OpenAPI lint + published docs URL        |
| UR-A04              | FR-AUDIT-05, FR-AUDIT-06                | Audit UI demo, CSV export validation     |

A complete matrix SHALL be maintained in a tracking tool (e.g., Jira custom field linking issues to FR/UR IDs).

---

## 12. Appendices

### 12.1 Appendix A — Open Questions

| ID  | Question                                                                                  | Owner          | Resolution Needed By |
| --- | ----------------------------------------------------------------------------------------- | -------------- | -------------------- |
| Q-1 | Which rich text editor library (TipTap, Lexical, Slate, ProseMirror) will be standardized? | Tech Lead      | Sprint 0             |
| Q-2 | Is multi-factor authentication required for Admin role at MVP, or deferred to Phase 2?     | Security Lead  | Sprint 0             |
| Q-3 | Will media be served via CDN at launch?                                                    | DevOps         | Sprint 1             |
| Q-4 | Confirm data residency region.                                                             | Product Owner  | Sprint 0             |
| Q-5 | Confirm acceptable cost ceiling for managed services.                                      | Sponsor        | Sprint 0             |

### 12.2 Appendix B — Out-of-Scope Reminder

See Requirements doc Section 7. Any in-flight request for items listed there SHALL go through change control.

### 12.3 Appendix C — Glossary

See Requirements doc Section 11 and Section 1.3 of this SRS.

### 12.4 Appendix D — Document Change Log

| Version | Date       | Author | Change                          |
| ------- | ---------- | ------ | ------------------------------- |
| 1.0     | 2026-05-11 | —      | Initial MVP SRS drafted         |

---

**End of Document**
