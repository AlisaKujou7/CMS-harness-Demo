# ARCH.md — Structural Architecture Document

## Content Management System (CMS) — MVP

| Field             | Value                                            |
| ----------------- | ------------------------------------------------ |
| Document Type     | Structural Architecture Document                 |
| Document Version  | 1.0                                              |
| Status            | Draft                                            |
| Date              | 2026-05-11                                       |
| Classification    | Internal                                         |
| Frontend Pattern  | Reactive Architecture (Unidirectional Data Flow) |
| Backend Pattern   | Hexagonal Architecture (Ports & Adapters)        |
| Companion Docs    | 01-Requirements-Specification.md, 02-Software-Requirements-Specification.md, 03-DESIGN.md |

---

## Table of Contents

1. Introduction
2. Architectural Goals & Drivers
3. System Context & Boundaries
4. Backend — Hexagonal Architecture
   - 4.1 Concepts & Principles
   - 4.2 Layer Structure
   - 4.3 Ports (Inbound & Outbound)
   - 4.4 Adapters (Driving & Driven)
   - 4.5 Domain Model
   - 4.6 Application Services
   - 4.7 Module Decomposition
   - 4.8 Dependency Rules
   - 4.9 Cross-Cutting Concerns
   - 4.10 Folder Structure
5. Frontend — Reactive Architecture
   - 5.1 Concepts & Principles
   - 5.2 Reactive Layers
   - 5.3 State Management Architecture
   - 5.4 Data Flow (Unidirectional)
   - 5.5 Observable Streams & Side Effects
   - 5.6 Component Architecture
   - 5.7 Module Decomposition
   - 5.8 Dependency Rules
   - 5.9 Folder Structure
6. Integration Architecture (FE ↔ BE)
7. Cross-Stack Concerns
8. Architecture Decision Records (ADRs)
9. Testing Strategy per Layer
10. Evolution & Extension Guidelines
11. Appendices

---

## 1. Introduction

### 1.1 Purpose

This document defines the **structural architecture** of the CMS MVP. It complements:

- `02-Software-Requirements-Specification.md` (what to build)
- `03-DESIGN.md` (how it looks and feels)

This document specifies **how the code is organized** to make the system maintainable, testable, and extensible. It is prescriptive: violating the rules here is a code review failure.

### 1.2 Architectural Patterns Chosen

| Tier     | Pattern                                         | Rationale                                            |
| -------- | ----------------------------------------------- | ---------------------------------------------------- |
| Backend  | **Hexagonal (Ports & Adapters)** by Alistair Cockburn | Isolates domain from frameworks/IO; testable; extension-friendly |
| Frontend | **Reactive Architecture** (unidirectional flow, observable streams, declarative UI) | Predictable state, scalable to many features, natural fit for real-time concerns |

### 1.3 Audience

| Audience              | Primary Sections                |
| --------------------- | ------------------------------- |
| Backend Developers    | 4, 6, 7, 8, 9                   |
| Frontend Developers   | 5, 6, 7, 8, 9                   |
| Tech Leads            | All                             |
| Code Reviewers        | 4.8, 5.8, 8                     |
| New Team Members      | 1, 2, 3, 4.1, 5.1               |

---

## 2. Architectural Goals & Drivers

### 2.1 Quality Attribute Goals

| Goal               | Priority | How architecture supports it                                  |
| ------------------ | -------- | ------------------------------------------------------------- |
| Testability        | High     | Hexagonal: domain pure; Reactive: pure reducers, mock streams |
| Maintainability    | High     | Clear layer boundaries; explicit dependencies                 |
| Replaceability     | High     | Swap database, email provider, UI library without domain changes |
| Extensibility      | High     | New content types, new channels via new adapters/features     |
| Predictability     | High     | Unidirectional data flow; immutable state                     |
| Performance        | Medium   | Reactive streams enable fine-grained UI updates; query/command separation in BE |
| Operability        | Medium   | Cross-cutting observability injected at the boundaries        |

### 2.2 Architectural Drivers

1. **MVP today, platform tomorrow** — Choose patterns that scale to multi-content-type, multi-channel, multi-language without rewriting cores.
2. **Two-developer team initial** — Patterns must be teachable and have clear conventions.
3. **Multiple integration directions** — Headless API, future webhooks, future SSO. Domain must not care which.
4. **Daily user UX** — Frontend state must be predictable, responsive, and recoverable.

---

## 3. System Context & Boundaries

### 3.1 System Context Diagram (C4 Level 1)

```
                          ┌────────────────────────┐
                          │  Editor / Author /     │
                          │  Admin (Human User)    │
                          └───────────┬────────────┘
                                      │ HTTPS
                                      ▼
       ┌──────────────────────────────────────────────────────┐
       │                                                       │
       │              CMS System (this document)               │
       │                                                       │
       │   ┌──────────────────┐      ┌──────────────────┐     │
       │   │  Admin SPA       │      │  Application     │     │
       │   │  (Reactive FE)   │◀────▶│  Server          │     │
       │   │                  │      │  (Hexagonal BE)  │     │
       │   └──────────────────┘      └──────────────────┘     │
       │                                                       │
       └──┬───────────────────────────────────────────┬───────┘
          │                                           │
          │ HTTPS / API key                           │ TCP / API
          ▼                                           ▼
   ┌──────────────┐                          ┌──────────────────┐
   │  Public      │                          │  Email provider  │
   │  Frontends   │                          │  Object storage  │
   │  (Web/Mobile)│                          │  PostgreSQL      │
   └──────────────┘                          │  Redis           │
                                             └──────────────────┘
```

### 3.2 System Boundaries

- **Inside the boundary**: Admin SPA, Application Server, all business logic and domain rules.
- **Outside the boundary**: User browsers, public frontends, all infrastructure dependencies (DB, storage, email, cache).

Hexagonal puts the **domain** at the center, treats *everything outside* as external — including HTTP, the database, and email. Reactive on the frontend puts **state** at the center, treats user input and server responses as external events flowing through streams.

---

## 4. Backend — Hexagonal Architecture

### 4.1 Concepts & Principles

**Hexagonal Architecture** (a.k.a. Ports & Adapters) organizes code around a pure **domain** that knows nothing about the outside world. Two kinds of boundary objects connect the domain to reality:

- **Ports** — interfaces *owned by* the application core. They describe *what the application needs* (outbound) or *what the application offers* (inbound).
- **Adapters** — concrete implementations of ports. **Driving adapters** call into the application (HTTP controllers, CLI, message consumers). **Driven adapters** are called by the application (PostgreSQL repository, S3 storage, email sender).

```
                  ┌────────────────────────────────────────┐
                  │            DRIVING ADAPTERS             │
                  │  (HTTP, CLI, Scheduler, Queue Consumer) │
                  └──────────────────┬─────────────────────┘
                                     │ calls
                                     ▼
                  ┌────────────────────────────────────────┐
                  │           INBOUND PORTS                  │
                  │  (Application Service Interfaces)        │
                  └──────────────────┬─────────────────────┘
                                     │
                  ┌──────────────────▼─────────────────────┐
                  │         APPLICATION CORE                │
                  │  ┌────────────────────────────────┐     │
                  │  │      DOMAIN (pure)              │     │
                  │  │  - Entities                     │     │
                  │  │  - Value Objects                │     │
                  │  │  - Domain Services              │     │
                  │  │  - Domain Events                │     │
                  │  └────────────────────────────────┘     │
                  │  ┌────────────────────────────────┐     │
                  │  │      APPLICATION                 │     │
                  │  │  - Use Cases / App Services      │     │
                  │  │  - Orchestration                 │     │
                  │  └────────────────────────────────┘     │
                  └──────────────────┬─────────────────────┘
                                     │ calls
                                     ▼
                  ┌────────────────────────────────────────┐
                  │          OUTBOUND PORTS                  │
                  │  (Repository / Gateway Interfaces)       │
                  └──────────────────┬─────────────────────┘
                                     │ implemented by
                                     ▼
                  ┌────────────────────────────────────────┐
                  │           DRIVEN ADAPTERS                │
                  │  (PostgreSQL, Redis, S3, SES, Sentry)    │
                  └────────────────────────────────────────┘
```

### 4.1.1 Core Principles

1. **Dependency rule**: Dependencies point inward. Domain knows nothing. Application knows the domain. Adapters know the application. The outside knows the adapters.
2. **No framework in the domain**: No NestJS decorators, no Prisma types, no HTTP types inside `domain/`. The domain is plain TypeScript.
3. **Ports are interfaces**: Always declared in the inner layers; implementations live in adapter folders.
4. **One adapter per concern**: Swapping PostgreSQL for another DB means writing one new adapter; no domain changes.
5. **Domain events are explicit**: Domain changes that need to ripple (audit, cache invalidation) raise events; adapters subscribe.

### 4.2 Layer Structure

| Layer            | Knows about                  | Examples                                       |
| ---------------- | ---------------------------- | ---------------------------------------------- |
| Domain           | Nothing external             | `Content`, `User`, `Slug`, `ContentLifecycle` |
| Application      | Domain + Ports                | `PublishContent`, `InviteUser` use cases       |
| Inbound Adapter  | Application (ports)           | `ContentController`, `SchedulerCron`           |
| Outbound Adapter | Application (ports), externals | `PrismaContentRepository`, `SesEmailAdapter` |
| Composition Root | Everything                    | `main.ts`, DI module wiring                    |

### 4.3 Ports

#### 4.3.1 Inbound Ports (use case interfaces)

Inbound ports describe **what the application can do**. They are consumed by driving adapters.

Example (TypeScript, conceptual):

```typescript
// src/modules/content/application/ports/in/publish-content.port.ts
export interface PublishContentUseCase {
  execute(command: PublishContentCommand): Promise<PublishContentResult>;
}

export type PublishContentCommand = {
  contentId: ContentId;
  actorId: UserId;
};

export type PublishContentResult = {
  contentId: ContentId;
  status: ContentStatus;
  publishedAt: Date;
};
```

Inbound ports per module:

| Module   | Inbound Port (Use Case)                                |
| -------- | ------------------------------------------------------ |
| Auth     | `Login`, `RefreshToken`, `Logout`, `RequestPasswordReset`, `CompletePasswordReset` |
| Users    | `InviteUser`, `UpdateUserRole`, `DeactivateUser`, `ListUsers` |
| Content  | `CreateContent`, `UpdateContent`, `SubmitForReview`, `PublishContent`, `UnpublishContent`, `ScheduleContent`, `DeleteContent`, `ListContent`, `GetContent`, `RevertContent` |
| Media    | `PresignUpload`, `FinalizeMedia`, `UpdateMediaMetadata`, `DeleteMedia`, `ListMedia` |
| Audit    | `ListAuditEvents` (read-only); `RecordAuditEvent` (internal port, called only by application) |
| PublicAPI| `ListPublishedContent`, `GetPublishedContentBySlug`, `GetMediaMetadata` |

#### 4.3.2 Outbound Ports (gateway interfaces)

Outbound ports describe **what the application needs from the outside world**. They are declared by the application and implemented by driven adapters.

Example:

```typescript
// src/modules/content/application/ports/out/content-repository.port.ts
export interface ContentRepository {
  save(content: Content): Promise<void>;
  findById(id: ContentId): Promise<Content | null>;
  findBySlug(type: ContentType, slug: Slug): Promise<Content | null>;
  findMany(criteria: ContentSearchCriteria): Promise<PagedResult<Content>>;
  delete(id: ContentId): Promise<void>;
}
```

Outbound ports inventory:

| Concern              | Port Interface              | Implemented By                     |
| -------------------- | --------------------------- | ---------------------------------- |
| Content persistence  | `ContentRepository`         | `PrismaContentRepository`          |
| User persistence     | `UserRepository`            | `PrismaUserRepository`             |
| Audit persistence    | `AuditEventRepository`      | `PrismaAuditEventRepository`       |
| Media persistence    | `MediaRepository`           | `PrismaMediaRepository`            |
| Token persistence    | `RefreshTokenRepository`    | `PrismaRefreshTokenRepository`    |
| Object storage       | `ObjectStorage`             | `S3ObjectStorageAdapter`           |
| Email sending        | `EmailSender`               | `SesEmailAdapter`                  |
| Password hashing     | `PasswordHasher`            | `Argon2PasswordHasher`             |
| Token signing        | `TokenSigner`               | `JoseJwtSigner`                    |
| Clock                | `Clock`                     | `SystemClock` (real) / `FakeClock` (tests) |
| Identifier generator | `IdGenerator`               | `Uuidv4Generator`                  |
| Cache                | `Cache`                     | `RedisCacheAdapter`                |
| Event bus            | `DomainEventPublisher`      | `InProcessEventPublisher` (MVP) / future Redis pub/sub |
| Job scheduler        | `JobScheduler`              | `BullMqScheduler`                  |
| Logger               | `Logger`                    | `PinoLogger`                       |
| Metrics              | `Metrics`                   | `OtelMetrics`                      |

### 4.4 Adapters

#### 4.4.1 Driving (Inbound) Adapters

Driving adapters translate from the outside protocol into use case calls. They handle:

- Protocol concerns (HTTP routing, status codes, headers, content negotiation)
- Authentication context extraction (JWT verification, API key lookup)
- Request DTO validation (Zod schemas)
- Response DTO mapping (domain → JSON)
- Error mapping (domain exceptions → HTTP status codes)

| Adapter Type        | Examples                                              |
| ------------------- | ----------------------------------------------------- |
| HTTP REST           | `ContentController`, `UsersController`, `AuthController` |
| Cron / Scheduler    | `ScheduledPublishJob` (calls `PublishContent` for due items) |
| Queue Consumer      | `ImageVariantWorker` (consumes from BullMQ, calls `FinalizeMedia` variant step) |
| CLI (future ops)    | `seed-admin.command.ts`                               |

**Rule**: Driving adapters never instantiate domain entities directly. They invoke use cases.

#### 4.4.2 Driven (Outbound) Adapters

Driven adapters implement outbound port interfaces. They:

- Translate between domain objects and persistence/external formats
- Handle protocol-specific concerns (SQL, S3 API, SMTP)
- Encapsulate library specifics (Prisma client, AWS SDK)
- Never leak third-party types upward (no `PrismaClient` in application code)

Example:

```typescript
// src/modules/content/adapters/out/persistence/prisma-content.repository.ts
export class PrismaContentRepository implements ContentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(content: Content): Promise<void> {
    const data = ContentPersistenceMapper.toPersistence(content);
    await this.prisma.content.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: ContentId): Promise<Content | null> {
    const row = await this.prisma.content.findUnique({ where: { id: id.value } });
    return row ? ContentPersistenceMapper.toDomain(row) : null;
  }
  // ...
}
```

### 4.5 Domain Model

The domain layer contains **entities**, **value objects**, **domain services**, and **domain events**.

#### 4.5.1 Entities (have identity)

| Entity        | Identity        | Invariants                                      |
| ------------- | --------------- | ----------------------------------------------- |
| `User`        | `UserId` (UUID) | Email unique; role and status valid             |
| `Content`     | `ContentId`     | Slug unique per type; valid lifecycle transitions; publish requirements met |
| `ContentVersion` | `VersionId`  | Monotonically increasing version_no per content |
| `MediaItem`   | `MediaId`       | Storage key unique; size within limits          |
| `ApiKey`      | `ApiKeyId`      | Key hash unique; immutable after creation       |
| `RefreshToken`| `TokenId`       | Hash unique; expires_at in future at issue      |

#### 4.5.2 Value Objects (no identity, immutable)

| Value Object      | Validation                                  |
| ----------------- | ------------------------------------------- |
| `Email`           | RFC 5322                                    |
| `Slug`            | `^[a-z0-9]+(-[a-z0-9]+)*$`                  |
| `ContentStatus`   | Enum: draft/in_review/published/unpublished/archived |
| `ContentType`     | Enum: article/page                          |
| `UserRole`        | Enum: admin/editor/author                   |
| `RichTextBody`    | Sanitized structured content (ProseMirror JSON) |
| `SeoMetadata`     | Title ≤ 70, description ≤ 160               |
| `Tag`             | Non-empty, lowercase, ≤ 40 chars            |

Value objects are constructed via factory methods that throw on invalid input:

```typescript
export class Slug {
  private constructor(public readonly value: string) {}

  static create(input: string): Slug {
    const normalized = input.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalized)) {
      throw new InvalidSlugError(input);
    }
    return new Slug(normalized);
  }
}
```

#### 4.5.3 Domain Services

When logic doesn't naturally fit on an entity, it belongs to a domain service.

| Domain Service           | Responsibility                                                       |
| ------------------------ | -------------------------------------------------------------------- |
| `ContentLifecycleService` | Validates state transitions, applies transition side effects        |
| `SlugGenerator`          | Generates URL-safe slug candidates from a title                      |
| `PublishRequirementsChecker` | Checks that a Content satisfies all rules to be published        |

#### 4.5.4 Domain Events

Domain events are raised by entities when significant state changes occur. Application services collect them and publish them after the transaction commits.

| Event                    | Raised When               | Consumers                                  |
| ------------------------ | ------------------------- | ------------------------------------------ |
| `ContentPublished`       | Content transitions to Published | Audit, Cache invalidator, future Webhooks |
| `ContentUnpublished`     | Status changes from Published | Audit, Cache invalidator               |
| `ContentDeleted`         | Soft delete applied       | Audit, Cache invalidator                   |
| `UserInvited`            | New user invited          | Email sender                               |
| `UserDeactivated`        | User deactivated          | Refresh token revoker, Audit               |
| `MediaUploaded`          | Media finalized           | Variant generator job, Audit               |

### 4.6 Application Services (Use Cases)

Each use case is a class implementing an inbound port. It:

1. Loads domain entities via outbound ports.
2. Invokes domain methods.
3. Persists via outbound ports.
4. Publishes domain events.
5. Returns a result DTO.

Use cases do **not** contain business rules — those live on entities or domain services. Use cases **orchestrate**.

Example:

```typescript
// src/modules/content/application/use-cases/publish-content.use-case.ts
export class PublishContent implements PublishContentUseCase {
  constructor(
    private readonly contents: ContentRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock,
    private readonly events: DomainEventPublisher,
    private readonly tx: TransactionRunner,
  ) {}

  async execute(cmd: PublishContentCommand): Promise<PublishContentResult> {
    return this.tx.run(async () => {
      const [content, actor] = await Promise.all([
        this.contents.findById(cmd.contentId),
        this.users.findById(cmd.actorId),
      ]);

      if (!content) throw new ContentNotFoundError(cmd.contentId);
      if (!actor) throw new UserNotFoundError(cmd.actorId);

      // Authorization is a policy concern, but for clarity:
      if (!actor.canPublishContent()) {
        throw new ForbiddenError('Only editors and admins can publish');
      }

      content.publish(this.clock.now());   // domain method enforces invariants

      await this.contents.save(content);
      await this.events.publishAll(content.pullDomainEvents());

      return {
        contentId: content.id,
        status: content.status,
        publishedAt: content.publishedAt!,
      };
    });
  }
}
```

### 4.7 Module Decomposition

Each business module owns its own hexagon:

```
src/modules/
├── auth/
│   ├── domain/
│   ├── application/
│   │   ├── ports/
│   │   │   ├── in/
│   │   │   └── out/
│   │   └── use-cases/
│   └── adapters/
│       ├── in/
│       │   └── http/
│       └── out/
│           ├── persistence/
│           ├── crypto/
│           └── email/
├── users/
├── content/
├── media/
├── audit/
├── public-api/
└── notifications/
```

Modules communicate **only** through application ports (use cases) or **published domain events**. Direct cross-module entity references are forbidden.

### 4.8 Dependency Rules

These rules are enforced by:
- File-import linting (e.g., `eslint-plugin-boundaries` or `dependency-cruiser`).
- Code review.
- Architecture tests (e.g., `ts-arch`).

| From → To              | Allowed? |
| ---------------------- | -------- |
| domain → anything else | ❌ NO     |
| application → domain   | ✅ YES    |
| application → application/ports | ✅ YES |
| application → adapters | ❌ NO (use port interfaces) |
| adapters/in → application | ✅ YES (call use cases) |
| adapters/in → domain   | ❌ NO (must go through use cases) |
| adapters/out → application/ports/out | ✅ YES (implement) |
| adapters/out → domain  | ✅ YES (for mapping only) |
| adapters/in → adapters/out | ❌ NO |
| module A → module B internals | ❌ NO |
| module A → module B inbound ports | ✅ YES (cross-module orchestration only in composition root or saga) |

### 4.9 Cross-Cutting Concerns

Cross-cutting concerns are implemented as **interceptors/decorators around use cases**, not inside the domain.

| Concern             | Placement                                                  |
| ------------------- | ---------------------------------------------------------- |
| Logging             | Use case decorator: logs name, duration, success/failure   |
| Metrics             | Use case decorator: emits counter + histogram              |
| Tracing             | OpenTelemetry instrumentation at adapters/in (HTTP) and adapters/out (DB, HTTP clients) |
| Transactions        | `TransactionRunner` outbound port; use cases opt in        |
| Authorization       | Policy objects called by use cases; uniform `Forbidden` error mapping |
| Input validation    | Zod schemas at adapters/in (HTTP) BEFORE reaching use case |
| Error translation   | HTTP filter maps domain errors to HTTP status + standard error envelope |

### 4.10 Folder Structure (Detailed)

```
backend/
├── src/
│   ├── modules/
│   │   ├── content/
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── content.entity.ts
│   │   │   │   │   └── content-version.entity.ts
│   │   │   │   ├── value-objects/
│   │   │   │   │   ├── content-id.vo.ts
│   │   │   │   │   ├── slug.vo.ts
│   │   │   │   │   ├── content-status.vo.ts
│   │   │   │   │   └── seo-metadata.vo.ts
│   │   │   │   ├── events/
│   │   │   │   │   ├── content-published.event.ts
│   │   │   │   │   └── content-unpublished.event.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── content-lifecycle.service.ts
│   │   │   │   │   └── publish-requirements-checker.ts
│   │   │   │   └── errors/
│   │   │   │       ├── content-not-found.error.ts
│   │   │   │       ├── invalid-transition.error.ts
│   │   │   │       └── slug-conflict.error.ts
│   │   │   ├── application/
│   │   │   │   ├── ports/
│   │   │   │   │   ├── in/
│   │   │   │   │   │   ├── publish-content.port.ts
│   │   │   │   │   │   ├── create-content.port.ts
│   │   │   │   │   │   └── ...
│   │   │   │   │   └── out/
│   │   │   │   │       ├── content-repository.port.ts
│   │   │   │   │       └── ...
│   │   │   │   ├── use-cases/
│   │   │   │   │   ├── publish-content.use-case.ts
│   │   │   │   │   ├── create-content.use-case.ts
│   │   │   │   │   └── ...
│   │   │   │   └── policies/
│   │   │   │       └── content-access.policy.ts
│   │   │   └── adapters/
│   │   │       ├── in/
│   │   │       │   └── http/
│   │   │       │       ├── content.controller.ts
│   │   │       │       ├── dto/
│   │   │       │       │   ├── publish-content.request.ts
│   │   │       │       │   └── content.response.ts
│   │   │       │       └── mappers/
│   │   │       │           └── content-http.mapper.ts
│   │   │       └── out/
│   │   │           └── persistence/
│   │   │               ├── prisma-content.repository.ts
│   │   │               └── content-persistence.mapper.ts
│   │   ├── auth/         # same structure
│   │   ├── users/
│   │   ├── media/
│   │   ├── audit/
│   │   ├── public-api/
│   │   └── notifications/
│   ├── shared/
│   │   ├── kernel/           # truly shared domain primitives
│   │   │   ├── uuid.ts
│   │   │   ├── result.ts
│   │   │   └── paged-result.ts
│   │   ├── ports/            # cross-cutting outbound ports
│   │   │   ├── clock.port.ts
│   │   │   ├── id-generator.port.ts
│   │   │   ├── logger.port.ts
│   │   │   ├── cache.port.ts
│   │   │   ├── event-publisher.port.ts
│   │   │   └── transaction-runner.port.ts
│   │   └── adapters/         # cross-cutting outbound adapters
│   │       ├── system-clock.ts
│   │       ├── uuid-v4-generator.ts
│   │       ├── pino-logger.ts
│   │       ├── redis-cache.adapter.ts
│   │       └── in-process-event-publisher.ts
│   ├── config/
│   ├── composition/          # composition root: DI wiring
│   │   ├── modules/
│   │   └── app.module.ts
│   └── main.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── test/
    ├── unit/                 # domain + application
    ├── integration/          # adapters + DB
    └── e2e/                  # full HTTP
```

---

## 5. Frontend — Reactive Architecture

### 5.1 Concepts & Principles

**Reactive Architecture** organizes the UI around **observable streams of events** flowing through pure transformations into immutable state, which the view declaratively renders. Side effects are isolated, explicit, and testable.

Core tenets:

1. **Unidirectional data flow** — Events flow one way: User → Action → State → View. The view never mutates state directly.
2. **Immutable state** — State is replaced, never mutated. Enables time-travel debugging, predictable rendering, and easy diffing.
3. **Pure transformations** — Reducers and selectors are pure functions of input → output. No side effects, no I/O.
4. **Side effects at the edge** — Network calls, timers, storage live in dedicated effect handlers, not inside reducers or components.
5. **Declarative UI** — Components describe *what* to render given state. They don't issue commands.
6. **Streams as first-class** — User events, server events, and timers all flow through composable streams (Observables/Signals).

### 5.1.1 Why Reactive Here

- The CMS UI has rich asynchronous behavior: autosave, real-time status updates, concurrent uploads, optimistic updates, undo windows.
- Multiple sources of state changes (user, server polling, websockets future) must compose without race conditions.
- Reactive streams make these scenarios first-class instead of accidental complexity in component state.

### 5.2 Reactive Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                           VIEW LAYER                              │
│  Components (React) — declarative; consume state via selectors    │
│  Emit user actions via dispatch()                                 │
└────────────┬──────────────────────────────────────────▲──────────┘
             │ dispatch(action)                          │ selector / hook
             ▼                                           │
┌─────────────────────────────────────────────────────────────────┐
│                        ACTION LAYER                                │
│  Action creators — strongly typed events describing user intent    │
│  or server events. Plain serializable objects.                     │
└────────────┬─────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       EFFECT LAYER                                 │
│  Effects (epics / sagas / thunks) — listen to action streams,      │
│  perform side effects (API calls), dispatch result actions.        │
│  Pure when isolated; testable with marble tests.                   │
└────────────┬────────────────────────────────┬───────────▲────────┘
             │ result actions                  │ requests │ responses
             ▼                                 ▼          │
┌──────────────────────────────────┐   ┌──────────────────┴───────┐
│      REDUCER LAYER                │   │     API GATEWAY           │
│  Pure functions (state, action)   │   │  Encapsulated HTTP client │
│  → new state                      │   │  Auth, retries, mapping   │
└────────────┬─────────────────────┘   └──────────────────────────┘
             │ writes
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        STATE LAYER                                 │
│  Single source of truth. Normalized. Immutable.                   │
│  Sliced by feature domain.                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 State Management Architecture

#### 5.3.1 State Categorization

| Category          | Definition                                       | Tool                    |
| ----------------- | ------------------------------------------------ | ----------------------- |
| **Server state**  | Cached data from the backend; has freshness, retry, refetch semantics | **TanStack Query** (RxJS-like async streams under the hood) |
| **UI state**      | Ephemeral, view-specific (modals, drawers, focus) | **Zustand** with slices |
| **Form state**    | Field values, validation, dirty/touched           | **React Hook Form**     |
| **Routing state** | URL, params                                       | **React Router**        |
| **Stream state**  | Cross-cutting reactive flows (autosave, uploads)  | **RxJS** Observables    |

This is a deliberately **layered** approach: each tool excels at one category. The "Reactive Architecture" is the *composition pattern* across them, not a single library.

#### 5.3.2 State Shape (Normalized)

```typescript
// Global UI state (Zustand)
interface UiState {
  theme: { mode: 'light' | 'dark' | 'system' };
  nav: { railCollapsed: boolean; drawerOpen: boolean };
  toasts: Toast[];
  dialogs: { confirmDelete: { open: boolean; targetId?: string } };
}

// Server state (TanStack Query cache, normalized by query key)
// Examples of query keys:
// ['content', { filter }] → PagedResult<Content>
// ['content', id]         → Content
// ['users']               → User[]
// ['audit', { filter }]   → PagedResult<AuditEvent>

// Form state (per-form, scoped to component)
// — handled by React Hook Form internally; not in global store
```

#### 5.3.3 Why Not a Single Redux Store?

The team is two people; the system is medium-complexity. Forcing all state into one store (Redux/MobX) creates ceremony without payoff. The split above keeps each kind of state in the tool that handles it best, while still enforcing reactive principles (immutability, unidirectional flow, isolated effects).

### 5.4 Data Flow (Unidirectional)

#### 5.4.1 User Action → Server Mutation

```
User clicks "Publish" button
       │
       ▼
Component calls publishMutation.mutate({ contentId })
       │
       ▼
TanStack Query mutation function calls api.content.publish(contentId)
       │
       ▼
API Gateway makes HTTP POST /api/admin/content/{id}/publish
       │
       ▼
Backend responds with updated Content DTO
       │
       ▼
onSuccess: queryClient.invalidateQueries(['content'])
           dispatch toast: "Article published"
       │
       ▼
TanStack Query refetches affected queries
       │
       ▼
Components subscribing to those queries automatically re-render
```

#### 5.4.2 Background Stream → State Update

Autosave is modeled as an RxJS pipeline:

```typescript
// features/content/streams/autosave.stream.ts
const autosave$ = formValueChanges$.pipe(
  filter(form => form.isDirty && form.isValid),
  debounceTime(30_000),                          // 30 s of inactivity
  distinctUntilChanged(deepEqual),
  switchMap(formValue =>                          // cancel previous in-flight save
    from(api.content.update(formValue.id, formValue)).pipe(
      map(saved => ({ kind: 'saved', at: new Date(), data: saved })),
      catchError(err => of({ kind: 'error', error: err })),
      startWith({ kind: 'saving' }),
    )
  ),
);
```

The component subscribes to `autosave$` and renders the indicator ("Saving..." → "Saved 5s ago" → "Couldn't save").

### 5.5 Observable Streams & Side Effects

#### 5.5.1 Where Streams Live

| Stream                       | Concern                            |
| ---------------------------- | ---------------------------------- |
| `autosave$`                  | Content editor autosave            |
| `uploadProgress$`            | Per-file upload progress           |
| `connectivity$`              | Online/offline detection           |
| `idleSession$`               | Detect inactivity for session timeout warning |
| `notification$`              | Server-pushed events (future SSE/WebSocket) |
| `globalErrors$`              | Aggregated unhandled API errors    |

#### 5.5.2 Side Effect Isolation

All side effects (HTTP, storage, timers) are wrapped in:

- **API Gateway functions** for HTTP.
- **Persistence adapters** for `localStorage` / `sessionStorage` (auth token, theme preference).
- **Browser API wrappers** for clipboard, file picker, notification permission.

Components never call `fetch`, `localStorage`, or `setTimeout` directly.

### 5.6 Component Architecture

#### 5.6.1 Component Categories

| Category         | Responsibility                              | Example                       |
| ---------------- | ------------------------------------------- | ----------------------------- |
| **Page**         | Top-level route component; orchestrates feature | `ContentEditorPage`        |
| **Feature**      | Owns a feature's local UI logic              | `ContentEditor`               |
| **Container**    | Connects to state/queries; passes props down | `ContentListContainer`        |
| **Presentational** | Pure rendering from props; reusable        | `StatusChip`, `ContentTable`  |
| **Design System** | MD3 primitives; no business logic           | `Button`, `Card`, `TextField` |

**Rule of thumb**: deeper in the tree = more presentational. Pages connect to state; leaves take props only.

#### 5.6.2 Component-State Subscription Rules

| Component category | May read state from           | May dispatch actions |
| ------------------ | ----------------------------- | -------------------- |
| Page               | Queries + UI store + URL      | Yes                  |
| Feature            | Queries + UI store (scoped)   | Yes                  |
| Container          | Queries (specific)            | Yes                  |
| Presentational     | Props only                    | Via prop callbacks   |
| Design System      | Props only                    | Via prop callbacks   |

A `StatusChip` does not call `useQuery`. A `ContentListPage` does.

### 5.7 Module Decomposition

```
src/
├── app/                      # Application shell
│   ├── routes/               # Route definitions
│   ├── providers/            # Theme, QueryClient, Auth, ErrorBoundary
│   └── layouts/
├── features/                 # Feature modules — vertical slices
│   ├── auth/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/            # useLogin, useCurrentUser
│   │   ├── api/              # Auth-specific API client functions
│   │   ├── streams/          # Auth-specific streams (e.g., session idle)
│   │   └── types/
│   ├── content/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/            # useContentList, usePublishContent
│   │   ├── api/
│   │   ├── streams/          # autosave$
│   │   └── types/
│   ├── media/
│   ├── users/
│   ├── audit/
│   └── api-keys/
├── design-system/            # MD3 primitives
│   ├── tokens/
│   ├── components/
│   └── theme/
├── shared/                   # Cross-cutting non-domain code
│   ├── api/                  # API client, interceptors, base hooks
│   ├── stores/               # Global Zustand slices (ui, toasts)
│   ├── streams/              # connectivity$, idleSession$, globalErrors$
│   ├── hooks/                # useDebounce, useMediaQuery
│   ├── utils/
│   └── types/
└── main.tsx
```

Each feature is a **vertical slice**: it contains its own pages, components, hooks, api, and types. A feature does NOT reach into another feature's internals; cross-feature dependencies go through `shared/` or via routing.

### 5.8 Dependency Rules

| From → To                                | Allowed? |
| ---------------------------------------- | -------- |
| design-system → anything else            | ❌ NO     |
| design-system → design-system/tokens     | ✅ YES    |
| shared → design-system                   | ✅ YES    |
| shared → features                        | ❌ NO     |
| features → design-system                 | ✅ YES    |
| features → shared                        | ✅ YES    |
| feature A → feature B                    | ❌ NO (use routing or shared/)|
| pages → feature components/hooks (same feature) | ✅ YES |
| presentational component → query hook    | ❌ NO (props only)    |
| presentational component → store         | ❌ NO (props only)    |

Enforced by import-linting (`eslint-plugin-boundaries`).

### 5.9 Folder Structure (Detailed Example: content feature)

```
features/content/
├── pages/
│   ├── ContentListPage.tsx             # Container: queries + UI state
│   ├── ContentEditorPage.tsx           # Container: autosave stream + mutation
│   └── VersionHistoryPage.tsx
├── components/
│   ├── ContentTable.tsx                # Presentational: takes items prop
│   ├── StatusChip.tsx                  # Presentational
│   ├── PublishMenu.tsx                 # Container (small): publish mutation
│   ├── RichTextEditor.tsx              # TipTap wrapper
│   ├── SeoPanel.tsx                    # Form section
│   └── AutosaveIndicator.tsx           # Subscribes to autosave$
├── hooks/
│   ├── useContentList.ts               # Wraps useQuery
│   ├── useContent.ts                   # Wraps useQuery
│   ├── usePublishContent.ts            # Wraps useMutation + toast effect
│   ├── useUpdateContent.ts
│   └── useAutosave.ts                  # Bridges form → autosave$ → indicator
├── api/
│   ├── content.api.ts                  # Pure HTTP functions
│   └── content.dto.ts                  # Request/response types
├── streams/
│   └── autosave.stream.ts              # RxJS pipeline
└── types/
    └── content.types.ts                # Frontend domain types (UI-facing)
```

---

## 6. Integration Architecture (FE ↔ BE)

### 6.1 Contract

The frontend and backend share **contracts**, not types. Concretely:

- **OpenAPI 3.1 spec** generated from backend annotations is the source of truth.
- Frontend generates TypeScript client types from this spec at build time.
- Zod schemas (or equivalent) are co-located with the OpenAPI spec for runtime validation on the FE.

Benefit: change a port DTO once on the backend; FE types regenerate; mismatches fail at compile time.

### 6.2 Communication Patterns

| Pattern              | When                                            |
| -------------------- | ----------------------------------------------- |
| Request/response REST| Vast majority of admin CRUD                     |
| Long polling / SSE   | Future: live audit log tailing                  |
| WebSocket            | Future: real-time collaborative editing         |
| Direct S3 upload     | Media uploads via presigned URL (FE → S3)       |

### 6.3 Auth Token Flow Mapping

| FE Responsibility                                | BE Responsibility                            |
| ------------------------------------------------ | -------------------------------------------- |
| Hold access token in memory (Zustand store)      | Issue JWT (15 min), refresh token (14 d, hashed) |
| Send `Authorization: Bearer <access>` on each request | Verify JWT signature + expiry             |
| On 401, attempt token refresh once               | Validate refresh token + rotate              |
| On refresh failure, redirect to login            | Revoke refresh token on logout / pwd change  |
| Refresh token in httpOnly cookie                 | Set httpOnly + Secure + SameSite=Strict cookie |

### 6.4 Error Mapping Table

| Backend Domain Error          | HTTP Status | FE Behavior                                     |
| ----------------------------- | ----------- | ----------------------------------------------- |
| `ValidationError`             | 422         | Field-keyed error display in form               |
| `ForbiddenError`              | 403         | Toast "You don't have permission" + log         |
| `NotFoundError`               | 404         | Route to not-found page or inline error state   |
| `ConflictError` (slug/transition) | 409     | Inline field error or banner with retry option  |
| `RateLimitedError`            | 429         | Toast with retry-after info                     |
| Network / 5xx                 | —           | Snackbar "Couldn't reach server. Retry?"        |

---

## 7. Cross-Stack Concerns

### 7.1 Observability

| Concern  | Frontend                              | Backend                              |
| -------- | ------------------------------------- | ------------------------------------ |
| Logs     | Console (dev only); Sentry (errors)   | Pino structured JSON → log aggregator |
| Metrics  | Web Vitals → Sentry / analytics       | OpenTelemetry → Prometheus           |
| Traces   | OpenTelemetry browser SDK             | OpenTelemetry → Tempo / Datadog      |
| Errors   | Sentry capture + user context         | Sentry capture + request ID          |

**Correlation**: every HTTP request gets an `X-Request-Id` header. Backend creates one if missing. Frontend logs include this ID for errors. End-to-end traces tie frontend spans to backend spans via W3C `traceparent`.

### 7.2 Configuration

- **Backend**: 12-factor environment variables; secrets via secrets manager; config loaded at startup, validated by Zod, then immutable.
- **Frontend**: build-time `VITE_PUBLIC_*` variables for non-sensitive config (API URL, feature flags); runtime config endpoint for things that should not require rebuild.

### 7.3 Feature Flags

Both stacks consume the same feature flag service (e.g., a backend endpoint returning flags scoped to user/role). Frontend caches flags per session.

---

## 8. Architecture Decision Records (ADRs)

ADRs are short documents capturing significant decisions. The team maintains them in `docs/adr/NNNN-title.md`.

### 8.1 Initial ADRs for MVP

| ADR  | Title                                              | Status   |
| ---- | -------------------------------------------------- | -------- |
| 0001 | Use Hexagonal Architecture for the backend         | Accepted |
| 0002 | Use Reactive Architecture (composed) for frontend  | Accepted |
| 0003 | Single modular monolith (no microservices for MVP) | Accepted |
| 0004 | TanStack Query for server state                    | Accepted |
| 0005 | Zustand for global UI state, RxJS for cross-cutting streams | Accepted |
| 0006 | PostgreSQL as primary store; JSONB for content body| Accepted |
| 0007 | Prisma as the ORM; persistence mappers isolate it  | Accepted |
| 0008 | OpenAPI generated from code, FE types generated from spec | Accepted |
| 0009 | Domain events published in-process (Redis pub/sub later) | Accepted |
| 0010 | JWT short-lived + opaque refresh token (rotation + reuse detection) | Accepted |

### 8.2 ADR Template

```markdown
# ADR-NNNN: <Title>

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-XXXX

## Context
What is the issue motivating this decision?

## Decision
What did we decide?

## Consequences
- Positive
- Negative
- Neutral / trade-offs

## Alternatives Considered
What else did we look at, and why did we reject them?
```

---

## 9. Testing Strategy per Layer

### 9.1 Backend Testing Pyramid

```
                ┌─────────────────────┐
                │   E2E (Few)         │  Full HTTP, real DB, real S3 stub
                ├─────────────────────┤
                │  Integration (Some) │  Adapters + DB; per-port
                ├─────────────────────┤
                │  Application (Many) │  Use cases with fake adapters
                ├─────────────────────┤
                │  Domain (Many)      │  Pure unit tests on entities/VOs
                └─────────────────────┘
```

| Layer               | Test Type             | Tools                            | Speed   |
| ------------------- | --------------------- | -------------------------------- | ------- |
| Domain              | Pure unit             | Vitest / Jest                    | < 50 ms |
| Application (use case)| Unit with fakes     | Vitest + in-memory port fakes    | < 200 ms |
| Adapter out (Prisma)| Integration           | Vitest + Testcontainers Postgres | seconds |
| Adapter in (HTTP)   | Integration           | Supertest + NestJS test module   | seconds |
| End-to-end          | Full stack            | Playwright (FE) hitting real BE  | minutes |

**Key rule**: Domain tests never touch I/O. Application tests use fakes, not mocks (preserve behavior). Adapter tests verify the adapter, not the domain.

### 9.2 Frontend Testing Pyramid

```
                ┌─────────────────────┐
                │   E2E (Few)         │  Playwright user flows
                ├─────────────────────┤
                │ Component Integ.    │  RTL + MSW (mock HTTP)
                ├─────────────────────┤
                │   Unit (Many)       │  Reducers, selectors, streams (marble)
                └─────────────────────┘
```

| Concern               | Test Type            | Tools                                    |
| --------------------- | -------------------- | ---------------------------------------- |
| Pure functions        | Unit                 | Vitest                                   |
| Reducers / selectors  | Unit                 | Vitest                                   |
| RxJS streams          | Marble testing       | rxjs/testing TestScheduler               |
| Hooks (queries)       | Hook tests           | @testing-library/react-hooks + MSW       |
| Components (interactive)| Integration        | Testing Library + MSW                    |
| Visual regression     | Snapshot             | Chromatic / Storybook                    |
| End-to-end            | Browser              | Playwright                               |

---

## 10. Evolution & Extension Guidelines

### 10.1 Adding a New Content Type (e.g., "Recipe")

Because of hexagonal isolation:

1. Define new domain entity / VOs in `modules/content/domain/` (or split into a new module if substantially different).
2. Add use cases (or extend generic ones if shape allows).
3. Add HTTP routes in `adapters/in/http/`.
4. Add Prisma model + persistence mapper.
5. Add FE feature slice mirroring existing `content/` feature.
6. No changes to other modules.

### 10.2 Replacing the Database

1. Implement repository ports in a new adapter (e.g., `adapters/out/persistence/dynamo-content.repository.ts`).
2. Switch the binding in `composition/`.
3. Run integration tests against the new adapter.
4. Domain and application code untouched.

### 10.3 Adding a New Channel (e.g., webhooks)

1. Define new outbound port: `WebhookPublisher`.
2. Add domain event handlers that consume `ContentPublished` and call `WebhookPublisher`.
3. Implement adapter (HTTP client with retries).
4. Wire in composition root.
5. No changes to `PublishContent` use case (it just raises the event as today).

### 10.4 Splitting Into Microservices (Future)

Because each module owns a hexagon and modules communicate only via inbound ports or events, extracting a module into a separate service requires:

1. Replace in-process port call with HTTP/gRPC adapter.
2. Replace in-process event publisher with a message broker adapter.
3. Move the module's database tables to a separate schema/instance.
4. Domain logic does not change.

### 10.5 Frontend Extension: New Feature

1. Create `features/<new-feature>/` with pages, components, hooks, api, types.
2. Add route in `app/routes/`.
3. Add nav item in `app/layouts/AdminLayout.tsx`.
4. No changes to other features (shared utilities go to `shared/`).

---

## 11. Appendices

### 11.1 Appendix A — Glossary

| Term                | Definition                                                       |
| ------------------- | ---------------------------------------------------------------- |
| Hexagonal Architecture | A.k.a. Ports & Adapters. Isolates domain from external concerns. |
| Port                | An interface owned by the application core describing a capability or need. |
| Adapter             | Concrete implementation of a port, dealing with a specific technology. |
| Driving Adapter     | Adapter that calls into the application (HTTP, CLI, queue).      |
| Driven Adapter      | Adapter the application calls (DB, email, storage).              |
| Use Case            | Application service representing one business operation.        |
| Domain Event        | A fact about a state change in the domain, named in past tense.  |
| Reactive Architecture | UI architecture built on observable streams, immutable state, and unidirectional data flow. |
| Unidirectional Data Flow | Event → state mutation → UI render, never the reverse.    |
| Observable Stream   | A pipeline of asynchronous events (e.g., RxJS Observable).       |
| Composition Root    | The single place where adapters are wired to ports (DI setup).   |
| Vertical Slice      | A feature module containing all layers needed for that feature.  |

### 11.2 Appendix B — Architecture Checklist (Code Review)

**Backend PR checklist:**

- [ ] No imports from `adapters/*` inside `application/*` or `domain/*`.
- [ ] No third-party library types (Prisma, AWS SDK) leak into application/domain.
- [ ] New outbound dependencies expressed as ports.
- [ ] Domain invariants enforced on the entity, not in the controller.
- [ ] Use case has unit tests with in-memory port fakes.
- [ ] Domain events raised where appropriate.
- [ ] Authorization enforced at route AND service layer.
- [ ] OpenAPI spec updated.

**Frontend PR checklist:**

- [ ] No `fetch` / `localStorage` / `setTimeout` calls in components.
- [ ] Presentational components receive data only via props.
- [ ] New cross-feature dependencies go through `shared/`.
- [ ] Query keys follow naming convention.
- [ ] RxJS streams have unit tests using marble syntax (where logic is non-trivial).
- [ ] Components subscribe to the minimum state they need.
- [ ] No direct mutation of state.
- [ ] Error and loading states implemented.
- [ ] Generated FE types regenerated from the latest OpenAPI spec.

### 11.3 Appendix C — Diagrams Legend

- **Rectangle**: System or component.
- **Cylinder**: Datastore.
- **Arrow**: Direction of dependency or data flow (as labeled).
- **Hexagon**: Application core (in hexagonal diagrams).
- **Box-in-box**: Containment (e.g., adapter contains mapper).

### 11.4 Appendix D — Recommended Reading

- Cockburn, A. — *Hexagonal Architecture* (2005)
- Vernon, V. — *Implementing Domain-Driven Design*
- Evans, E. — *Domain-Driven Design*
- Abramov, D. — Redux docs (still excellent for reactive principles)
- Staltz, A. — *The Introduction to Reactive Programming You've Been Missing*
- Fowler, M. — *Patterns of Enterprise Application Architecture*

### 11.5 Appendix E — Document Change Log

| Version | Date       | Author | Change                          |
| ------- | ---------- | ------ | ------------------------------- |
| 1.0     | 2026-05-11 | —      | Initial MVP architecture        |

---

**End of Document**
