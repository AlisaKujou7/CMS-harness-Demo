# TEST-STRATEGY.md — Test Strategy Document

## Content Management System (CMS) — MVP

| Field             | Value                                            |
| ----------------- | ------------------------------------------------ |
| Document Type     | Test Strategy Document                           |
| Document Version  | 1.0                                              |
| Status            | Draft                                            |
| Date              | 2026-05-11                                       |
| Classification    | Internal                                         |
| Development Model | Test-Driven Development (TDD)                    |
| Coverage Mandate  | ≥ 98% line/branch; 100% on critical paths        |
| Standard Followed | ISO/IEC/IEEE 29119 (Software Testing)            |
| Companion Docs    | 01-Requirements, 02-SRS, 03-DESIGN, 04-ARCH, 05-METRICS |

---

## Table of Contents

1. Introduction
2. Test Objectives & Scope
3. Test Principles & Philosophy
4. Test Levels (the Test Pyramid)
5. Test Types
6. TDD Workflow & Discipline
7. Backend Test Strategy (Hexagonal)
8. Frontend Test Strategy (Reactive)
9. Integration & End-to-End Strategy
10. Non-Functional Test Strategy
11. Test Data Management
12. Test Environments
13. Test Automation Architecture
14. Defect Management
15. Roles & Responsibilities
16. Tools & Infrastructure
17. Test Deliverables
18. Risks & Mitigations
19. Appendices

---

## 1. Introduction

### 1.1 Purpose

This Test Strategy defines **what we test, how we test it, when we test, and who is responsible**. It binds together the requirements (01-02), design (03), architecture (04), and quality metrics (05) into an executable testing approach.

It is the authoritative reference for every test-related decision on the project. Test plans for individual features must align with this strategy.

### 1.2 Scope

| In Scope                                          | Out of Scope                              |
| ------------------------------------------------- | ----------------------------------------- |
| Functional testing strategy across all layers     | Manual UAT scripts (separate doc)         |
| Non-functional testing (perf, security, a11y)     | Production monitoring (separate doc)      |
| Test automation framework architecture            | Penetration testing (separate engagement) |
| TDD discipline and test pyramid enforcement       | Internal team training plans              |
| Test environments, data, and tooling              |                                           |

### 1.3 Audience

| Audience                  | Primary Sections          |
| ------------------------- | ------------------------- |
| Developers (BE / FE)      | 3, 4, 6, 7, 8, 11, 13     |
| QA Engineers              | All                       |
| Tech Leads                | 2, 3, 4, 10, 15, 18       |
| DevOps                    | 12, 13, 16                |
| Security Reviewers        | 5.4, 10.2                 |
| Product Owners            | 1, 2, 17                  |

### 1.4 References

- ISO/IEC/IEEE 29119 — Software Testing
- IEEE 829 — Test Documentation
- ISTQB Foundation Syllabus
- Companion documents: 01-Requirements, 02-SRS, 03-DESIGN, 04-ARCH, 05-METRICS

---

## 2. Test Objectives & Scope

### 2.1 Primary Objectives

1. **Verify** every requirement in the SRS is implemented correctly.
2. **Validate** the system meets user needs as defined in Requirements.
3. **Enforce** TDD discipline: no production code without a preceding failing test.
4. **Prevent regression** through ≥ 98% coverage and mutation testing.
5. **Detect early**: shift testing left so most defects are found in unit/integration, not E2E or production.
6. **Document** behavior through tests as living specifications.
7. **Enable change**: a high-quality test suite is what makes refactoring safe.

### 2.2 What We Are Testing

| Aspect                  | Tested?       |
| ----------------------- | ------------- |
| Backend domain logic    | ✅ Exhaustively |
| Backend application services (use cases) | ✅ With fakes for ports |
| Backend adapters (HTTP, DB, S3, email) | ✅ Integration tests |
| Frontend pure logic (reducers, selectors, streams) | ✅ Unit + marble |
| Frontend components     | ✅ Render + interaction |
| Frontend ↔ Backend contract | ✅ Contract test from OpenAPI |
| End-to-end user flows   | ✅ Smoke + critical paths |
| Performance under load  | ✅ Weekly synthetic + per-release |
| Security (SAST, deps, secrets) | ✅ Per PR + nightly |
| Accessibility (WCAG 2.1 AA) | ✅ Automated + manual |
| Visual regression       | ✅ For design system + key screens |

### 2.3 What We Do NOT Test (Justified)

- **Third-party library internals** — we test our adaptation of them, not them.
- **Generated code** (Prisma client, OpenAPI types) — excluded from coverage.
- **Composition root / DI wiring** — covered indirectly by E2E.
- **Logging-only branches** — measured but not asserted.

### 2.4 Quality Objectives (Bound to Metrics)

| Objective                                | Target              | Reference        |
| ---------------------------------------- | ------------------- | ---------------- |
| Overall line coverage                    | ≥ 98%               | 05-METRICS §3    |
| Overall branch coverage                  | ≥ 98%               | 05-METRICS §3    |
| Critical path coverage                   | 100% line + branch  | 05-METRICS §3.3  |
| Mutation score (overall)                 | ≥ 80%               | 05-METRICS §7    |
| Mutation score (critical paths)          | ≥ 90%               | 05-METRICS §7    |
| Test pyramid: unit % of total            | ≥ 70%               | 05-METRICS §7.3  |
| Test pyramid: e2e % of total             | ≤ 10%               | 05-METRICS §7.3  |
| Flaky test rate                          | ≤ 0.5%              | 05-METRICS §7.1  |
| Unit test suite duration                 | ≤ 60 s              | 05-METRICS §7.1  |
| E2E suite duration                       | ≤ 15 min            | 05-METRICS §7.1  |

---

## 3. Test Principles & Philosophy

### 3.1 Core Principles

1. **Test behavior, not implementation.** Tests describe what the system does, not how. This survives refactoring.
2. **Tests are first-class code.** Same review standards, same naming conventions, same DRY discipline (within reason).
3. **Tests are documentation.** A new developer should understand a module by reading its tests.
4. **Tests must be fast at the level they belong to.** Unit ≤ 50 ms; integration ≤ seconds; E2E ≤ minutes.
5. **Tests must be deterministic.** No `Math.random`, no `new Date()` (use injected `Clock`), no shared mutable state.
6. **Tests must be independent.** Any test must be runnable alone, in any order, in parallel.
7. **One assertion per concept, not per test.** A test can have multiple `expect()` calls if they verify one behavior.
8. **Tests fail for one reason.** If a test fails, the cause should be obvious.
9. **Prefer fakes over mocks.** Fakes preserve behavior; mocks couple tests to implementation.

### 3.2 The Testing Trophy (Refined Pyramid)

We adapt Kent C. Dodds' "Testing Trophy" idea but keep traditional pyramid proportions:

```
                              ╱─────────╲
                             ╱   E2E     ╲              ≤ 10%
                            ╱             ╲
                           ╱───────────────╲
                          ╱  Integration    ╲           20–25%
                         ╱                   ╲
                        ╱─────────────────────╲
                       ╱        Unit            ╲       ≥ 70%
                      ╱  (domain + application   ╲
                     ╱   + pure FE logic)         ╲
                    ╱_____________________________╲

                  ┌───────────────────────────────┐
                  │     STATIC (always green)      │
                  │  Lint + Types + Format         │
                  └───────────────────────────────┘
```

Static checks (TypeScript, ESLint, Prettier, architecture rules) are the foundation — they catch a class of errors before tests even run.

### 3.3 What "Good Test" Means

A test is good when it:

- Has a name that reads as a sentence about behavior ("should reject publish when SEO description is missing").
- Sets up only what is needed (no over-arranging).
- Acts on exactly one stimulus.
- Asserts on observable outcomes (return values, state changes, emitted events), not internals.
- Would catch a real bug if introduced (validated by mutation testing).
- Runs in isolation, deterministically, in under its layer's time budget.

### 3.4 What "Bad Test" Looks Like (Will Be Rejected in Review)

- Asserts on internal implementation (`expect(service.repository.findById).toHaveBeenCalled()`).
- Mocks the system under test.
- Tests setters/getters that have no behavior.
- Has assertions inside loops without descriptive failure messages.
- Depends on test execution order.
- Reads or writes shared files / real network.
- Has `await sleep(N)` instead of waiting on a real condition.
- Snapshot tests as the only assertion for non-trivial behavior.
- Tests that pass even when the system is broken (caught by mutation testing).

---

## 4. Test Levels (the Test Pyramid)

### 4.1 Level 0 — Static Analysis (Foundation)

Runs before any test executes. Catches entire categories of defects without writing tests.

| Check                              | Tool                          | Catches                              |
| ---------------------------------- | ----------------------------- | ------------------------------------ |
| TypeScript strict compile          | `tsc`                         | Type errors, null safety             |
| Lint                               | ESLint                        | Anti-patterns, unsafe patterns       |
| Format                             | Prettier                      | Style drift                          |
| Architecture rules                 | dependency-cruiser, ts-arch   | Hexagonal/Reactive violations        |
| Secrets                            | gitleaks                      | Committed credentials                |
| Dependency CVEs                    | Snyk / Dependabot             | Vulnerable libraries                 |
| SAST                               | Semgrep / CodeQL              | Security anti-patterns               |

### 4.2 Level 1 — Unit Tests (≥ 70% of test count)

**Scope**: A single function, class, or small cohesive unit. No I/O. No frameworks. No real time.

**Speed**: Median test < 10 ms. Suite < 60 s.

**What is a unit?**

- A pure function.
- A domain entity method.
- A value object factory.
- A domain service.
- An application use case (with all outbound ports replaced by in-memory fakes).
- A reducer or selector.
- A custom hook (isolated from networking via MSW).
- An RxJS stream (with virtual time scheduler).

**Tools**: Vitest. `rxjs/testing` TestScheduler for marbles.

### 4.3 Level 2 — Integration Tests (20–25%)

**Scope**: A module or slice talking to a real external dependency (DB, S3, HTTP server in process). Tests the **adapter**.

**Speed**: < 5 min for entire suite.

**What is an integration test here?**

- A repository against a real PostgreSQL (via Testcontainers).
- An HTTP controller against the real NestJS app (via Supertest), with the DB seeded.
- A mapper that round-trips an entity through Prisma persistence.
- An RxJS effect that hits a mocked API via MSW.
- A React component using its real query hooks against MSW.

**Tools**: Vitest + Testcontainers (BE); Vitest + React Testing Library + MSW (FE).

### 4.4 Level 3 — End-to-End Tests (≤ 10%)

**Scope**: The deployed system. Browser drives the SPA, which talks to a real backend, which talks to a real DB.

**Speed**: < 15 min total. Each test < 30 s.

**What is an E2E test here?**

- A complete user flow: "Editor logs in, creates an article, publishes it, sees it in public API."
- A regression test for a critical bug that crossed all layers.
- A smoke test that runs after deploy to verify the system is alive.

**Not E2E**: Anything testable at a lower layer. E2E is expensive — use sparingly.

**Tools**: Playwright with Page Object pattern.

### 4.5 Level 4 — Manual Exploratory Testing

Reserved for areas where automation cannot reach:

- Visual design fidelity vs Figma.
- Rich text editor UX subtleties (paste from Word, drag-and-drop images).
- Real email rendering in clients (Gmail, Outlook).
- Cross-browser quirks beyond the automation matrix.
- Accessibility with actual screen readers.

Manual sessions are time-boxed (60–90 min) with a written charter and findings log.

---

## 5. Test Types

### 5.1 Functional Test Types

| Type                       | Description                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Unit functional            | Verifies a unit performs its specified behavior.                                         |
| Integration functional     | Verifies units work together with real dependencies.                                     |
| Contract test              | Verifies the BE API matches the OpenAPI spec the FE consumes.                            |
| E2E functional             | Verifies a user-facing flow end to end.                                                  |
| Regression test            | Verifies a previously-fixed bug stays fixed. Every bug fix MUST add one.                 |
| Smoke test                 | Quick verification that critical paths still function after deploy.                      |
| Sanity test                | Quick verification of a specific feature after a small change.                           |
| Boundary value test        | Verifies behavior at the edges of valid input (max length, min/max number, empty).       |
| Equivalence partition test | One test per class of inputs that should be treated equivalently.                        |
| Negative test              | Verifies the system rejects invalid input correctly.                                     |

### 5.2 Non-Functional Test Types

| Type                       | Description                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Performance / load         | Verifies latency, throughput, resource use under expected load.                          |
| Stress                     | Pushes beyond expected load to find breaking point.                                      |
| Soak / endurance           | Long-running test to find memory leaks, connection pool exhaustion.                      |
| Security (SAST/DAST)       | Static and dynamic security scans.                                                       |
| Accessibility (a11y)       | WCAG 2.1 AA conformance (automated + manual).                                            |
| Usability                  | Manual review against design specs and heuristics.                                       |
| Compatibility / cross-browser | Verifies the SPA works on supported browsers.                                         |
| Localization-readiness     | Verifies no hardcoded strings, dates use locale, UTF-8 everywhere. (Localization itself is future.) |
| Visual regression          | Verifies UI hasn't shifted unexpectedly.                                                 |
| Resilience / chaos         | Verifies graceful degradation when dependencies fail. (Lightweight in MVP.)              |

### 5.3 Specialized Quality Test Types

| Type                       | Description                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Mutation testing           | Validates that tests actually assert behavior by mutating production code.               |
| Property-based testing     | Generates many inputs from a property; finds edge cases human-written tests miss. Used for value objects (Slug, Email) and pure utilities. |
| Snapshot testing           | Stores serialized output and detects unintended changes. Used sparingly for stable UI structure and OpenAPI spec. |
| Contract evolution test    | Detects breaking changes in the public API contract.                                     |

### 5.4 Security Test Types (Detailed)

| Type                            | When               | Tool                  |
| ------------------------------- | ------------------ | --------------------- |
| Dependency vulnerability scan   | Per PR + nightly   | Snyk, Dependabot      |
| SAST (static)                   | Per PR             | Semgrep, CodeQL       |
| Secret scan                     | Per commit + per PR | gitleaks             |
| Container image scan            | Per build          | Trivy                 |
| License compliance              | Per PR             | license-checker       |
| Authorization matrix tests      | Per PR (unit/integration) | custom + Vitest |
| Input validation tests (XSS, injection vectors) | Per PR | Vitest with payload corpus |
| Rate-limit tests                | Per PR (integration) | Supertest            |
| Penetration test (external)     | Pre-launch + annually | External vendor    |

---

## 6. TDD Workflow & Discipline

### 6.1 The Mandatory Cycle

```
   ┌─────────────────────────────────────┐
   │                                      │
   │  1. RED                              │
   │  Write a failing test that           │
   │  describes the next smallest         │
   │  behavior change.                    │
   │                                      │
   │  2. GREEN                            │
   │  Write the minimum production code   │
   │  to make the test pass.              │
   │                                      │
   │  3. REFACTOR                         │
   │  With tests green, improve           │
   │  structure. Re-run tests after       │
   │  every change.                       │
   │                                      │
   └─────────────────────────────────────┘
                  ▲
                  │ Repeat in small steps
                  │ (target: green every 10 min)
```

### 6.2 TDD Rules of Engagement

1. No production code is written without a failing test that requires it.
2. Write only enough test to fail (compilation errors count as failures).
3. Write only enough production code to pass.
4. Refactor only when green.
5. Commit small, commit often. Aim for green-on-merge every 10–30 min of work.
6. Bug fix → write failing regression test FIRST, then fix.
7. When unsure where to start, write the test for public behavior, not implementation.

### 6.3 Why TDD Fits This Project

- **Hexagonal Architecture** demands testable design. TDD naturally produces small, port-driven units.
- **Reactive Frontend** has many streams and async flows. TDD with marble tests makes them tractable.
- **98% coverage gate** is a side effect of TDD, not an extra cost.
- **Mutation testing 80%** weeds out weak tests; TDD produces strong assertions because tests come first.

### 6.4 TDD Anti-Patterns

| Anti-pattern                                    | Why it's bad                                |
| ----------------------------------------------- | ------------------------------------------- |
| Writing all tests after the production code     | Defeats the purpose; usually leads to coupling to implementation |
| Writing tests for code you don't intend to change | Wasteful; tests should describe behavior under change |
| Skipping refactor step                          | Tech debt accumulates                       |
| Writing tests that only verify "no exception thrown" | No real assertion; fails mutation testing |
| Mocking what you don't own                       | Brittle; mock interfaces you own, fake what you don't |

### 6.5 TDD Outside-In vs Inside-Out

Both are valid. Choose per situation:

- **Inside-Out (Classical / Detroit)**: Start with domain. Build outward. Best for new domains where you understand the rules.
- **Outside-In (Mockist / London)**: Start with the use case or controller, mock collaborators, work inward. Best when you understand the user flow but not the internals.

For CMS MVP, we **default to inside-out for domain-rich modules** (content, audit lifecycle) and **outside-in for orchestration-heavy modules** (auth flows).

### 6.6 TDD Worked Example (Publish Content)

```
Step 1 (red):     content.entity.spec.ts
                  it('publish() transitions draft → published with timestamp')
                  → fails: publish() doesn't exist

Step 2 (green):   Add minimal publish() method
                  → green

Step 3 (red):     it('publish() rejects when SEO description missing')
                  → fails

Step 4 (green):   Add validation
                  → green

Step 5 (refactor):Extract PublishRequirementsChecker domain service
                  → tests stay green

Step 6 (red):     publish-content.use-case.spec.ts
                  it('requires editor or admin role')
                  → fails

Step 7 (green):   Add authorization in use case
                  → green

Step 8 (red):     it('writes audit event after publish')
                  → fails

Step 9 (green):   Raise ContentPublished domain event in entity;
                  publish events in use case after save
                  → green

... continues until full behavior covered ...
```

Each commit is small. Every commit leaves the suite green (except deliberate `red:` commits used as bookmarks, which are squashed before merge or rebased green-only).

---

## 7. Backend Test Strategy (Hexagonal)

### 7.1 Test Strategy by Hexagonal Layer

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEXAGONAL LAYER             │  TEST LEVEL        │  TARGET COVERAGE │
├──────────────────────────────┼───────────────────┼──────────────────┤
│  Domain (entities, VOs)      │  Unit              │  100% / 100%     │
│  Domain services             │  Unit              │  100% / 100%     │
│  Application use cases       │  Unit (with fakes) │  100% / ≥98%     │
│  Inbound adapters (HTTP)     │  Integration       │  ≥95% / ≥95%     │
│  Outbound adapters (DB, S3)  │  Integration       │  ≥95% / ≥95%     │
│  Composition root            │  Indirect (E2E)    │  excluded        │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Domain Layer Testing

**Rules**:
- Pure unit tests only. No I/O, no time, no random.
- Time and randomness injected via ports (`Clock`, `IdGenerator`) — but domain doesn't depend on them; only application does.
- Test every value object factory with both valid and invalid input.
- Test every state transition (valid and invalid) on entities.
- Test every domain event is raised correctly.

**Example: Value Object Test (Slug)**

```typescript
describe('Slug', () => {
  describe('create', () => {
    it.each([
      ['hello-world', 'hello-world'],
      ['MY-TITLE', 'my-title'],         // lowercased
      ['  spaced  ', null],             // trimmed but invalid (space inside)
    ])('normalizes "%s" to "%s"', (input, expected) => {
      if (expected === null) {
        expect(() => Slug.create(input)).toThrow(InvalidSlugError);
      } else {
        expect(Slug.create(input).value).toBe(expected);
      }
    });

    it('rejects empty string', () => {
      expect(() => Slug.create('')).toThrow(InvalidSlugError);
    });

    it('rejects consecutive hyphens', () => {
      expect(() => Slug.create('foo--bar')).toThrow(InvalidSlugError);
    });
  });
});
```

**Property-based testing** is used for value objects with complex invariants:

```typescript
import fc from 'fast-check';

describe('Slug (property)', () => {
  it('any valid slug round-trips through create', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
        (input) => {
          expect(Slug.create(input).value).toBe(input);
        },
      ),
    );
  });
});
```

### 7.3 Application Layer Testing (Use Cases)

**Rules**:
- Replace all outbound ports with **in-memory fakes**, never mocks.
- Fakes implement the full port interface and behave correctly.
- One fake per port lives in `test/fakes/`.
- Test happy path, authorization, validation, error paths, idempotency where applicable.

**In-memory fake example**:

```typescript
// test/fakes/in-memory-content.repository.ts
export class InMemoryContentRepository implements ContentRepository {
  private store = new Map<string, Content>();

  async save(content: Content): Promise<void> {
    this.store.set(content.id.value, content);
  }

  async findById(id: ContentId): Promise<Content | null> {
    return this.store.get(id.value) ?? null;
  }

  async findBySlug(type: ContentType, slug: Slug): Promise<Content | null> {
    for (const c of this.store.values()) {
      if (c.type === type && c.slug.equals(slug)) return c;
    }
    return null;
  }

  // ... other methods
}
```

**Use case test example**:

```typescript
describe('PublishContent', () => {
  let useCase: PublishContent;
  let contents: InMemoryContentRepository;
  let users: InMemoryUserRepository;
  let clock: FakeClock;
  let events: FakeDomainEventPublisher;

  beforeEach(() => {
    contents = new InMemoryContentRepository();
    users = new InMemoryUserRepository();
    clock = new FakeClock('2026-05-11T10:00:00Z');
    events = new FakeDomainEventPublisher();
    useCase = new PublishContent(contents, users, clock, events, new FakeTx());
  });

  it('publishes draft content for an editor', async () => {
    const editor = aUser({ role: 'editor' });
    const draft = aContent({ status: 'draft', authorId: editor.id });
    await users.save(editor);
    await contents.save(draft);

    const result = await useCase.execute({ contentId: draft.id, actorId: editor.id });

    expect(result.status).toBe('published');
    expect(result.publishedAt).toEqual(new Date('2026-05-11T10:00:00Z'));
    expect(events.published).toContainEqual(
      expect.objectContaining({ type: 'ContentPublished', contentId: draft.id }),
    );
  });

  it('rejects publish from an author', async () => {
    const author = aUser({ role: 'author' });
    const draft = aContent({ status: 'draft', authorId: author.id });
    await users.save(author);
    await contents.save(draft);

    await expect(
      useCase.execute({ contentId: draft.id, actorId: author.id }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects publishing already-published content', async () => {
    const editor = aUser({ role: 'editor' });
    const published = aContent({ status: 'published', authorId: editor.id });
    await users.save(editor);
    await contents.save(published);

    await expect(
      useCase.execute({ contentId: published.id, actorId: editor.id }),
    ).rejects.toThrow(InvalidTransitionError);
  });

  it('rejects publish when SEO description is missing', async () => {
    const editor = aUser({ role: 'editor' });
    const draft = aContent({ status: 'draft', authorId: editor.id, seoDescription: null });
    await users.save(editor);
    await contents.save(draft);

    await expect(
      useCase.execute({ contentId: draft.id, actorId: editor.id }),
    ).rejects.toThrow(MissingRequiredFieldsError);
  });
});
```

### 7.4 Inbound Adapter Testing (HTTP Controllers)

**Rules**:
- Use the framework's test module (NestJS Test) to build a real app with real wiring.
- Replace outbound adapters with in-memory fakes (test module overrides).
- Use Supertest for HTTP-level assertions.
- Test: status codes, response shape, validation errors, auth/authz, content types, error envelope.

**Example**:

```typescript
describe('POST /api/admin/content/:id/publish', () => {
  let app: INestApplication;
  let contents: InMemoryContentRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONTENT_REPOSITORY).useClass(InMemoryContentRepository)
      .overrideProvider(USER_REPOSITORY).useClass(InMemoryUserRepository)
      .overrideProvider(CLOCK).useValue(new FakeClock('2026-05-11T10:00:00Z'))
      .compile();
    app = module.createNestApplication();
    await app.init();
    contents = module.get(CONTENT_REPOSITORY);
  });

  afterEach(() => app.close());

  it('returns 200 with the published content', async () => {
    const editor = await seedUser(app, { role: 'editor' });
    const draft = await seedContent(app, { status: 'draft', authorId: editor.id });
    const token = await loginAs(app, editor);

    const res = await request(app.getHttpServer())
      .post(`/api/admin/content/${draft.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.status).toBe('published');
  });

  it('returns 403 for an author', async () => {
    const author = await seedUser(app, { role: 'author' });
    const draft = await seedContent(app, { authorId: author.id, status: 'draft' });
    const token = await loginAs(app, author);

    await request(app.getHttpServer())
      .post(`/api/admin/content/${draft.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect(res => {
        expect(res.body.error.code).toBe('FORBIDDEN');
      });
  });

  it('returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/content/some-id/publish`)
      .expect(401);
  });
});
```

### 7.5 Outbound Adapter Testing (Persistence)

**Rules**:
- Run against a **real PostgreSQL** instance via Testcontainers.
- Each test gets a clean schema (transaction-per-test or truncate-per-test).
- Test mapper round-trip: domain → persistence → domain.
- Test query correctness (filters, pagination, sorting).
- Test constraint behavior (unique slug, foreign keys).

**Example**:

```typescript
describe('PrismaContentRepository', () => {
  let pg: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repo: PrismaContentRepository;

  beforeAll(async () => {
    pg = await new PostgreSqlContainer('postgres:15').start();
    process.env.DATABASE_URL = pg.getConnectionUri();
    execSync('pnpm prisma migrate deploy');
    prisma = new PrismaClient();
    repo = new PrismaContentRepository(prisma);
  }, 60_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await pg.stop();
  });

  beforeEach(async () => {
    await prisma.content.deleteMany();
    await prisma.user.deleteMany();
  });

  it('round-trips a Content entity', async () => {
    const user = await seedUserRow(prisma);
    const content = aContent({ authorId: UserId.from(user.id) });

    await repo.save(content);
    const loaded = await repo.findById(content.id);

    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe(content.title);
    expect(loaded!.status).toBe(content.status);
    expect(loaded!.slug.value).toBe(content.slug.value);
  });

  it('enforces unique slug per content type', async () => {
    const user = await seedUserRow(prisma);
    const a = aContent({ type: 'article', slug: Slug.create('hello'), authorId: UserId.from(user.id) });
    const b = aContent({ type: 'article', slug: Slug.create('hello'), authorId: UserId.from(user.id) });

    await repo.save(a);
    await expect(repo.save(b)).rejects.toThrow(SlugConflictError);
  });
});
```

### 7.6 Backend Test Folder Structure

```
backend/
├── src/
│   └── modules/
│       └── content/
│           ├── domain/
│           │   ├── entities/content.entity.ts
│           │   └── entities/content.entity.spec.ts          ← co-located unit
│           ├── application/
│           │   └── use-cases/publish-content.use-case.ts
│           │   └── use-cases/publish-content.use-case.spec.ts  ← unit
│           └── adapters/
│               ├── in/http/content.controller.ts
│               └── out/persistence/prisma-content.repository.ts
└── test/
    ├── fakes/                              ← in-memory port fakes
    │   ├── in-memory-content.repository.ts
    │   ├── in-memory-user.repository.ts
    │   ├── fake-clock.ts
    │   ├── fake-domain-event-publisher.ts
    │   └── ...
    ├── builders/                           ← test data builders
    │   ├── a-content.ts
    │   ├── a-user.ts
    │   └── ...
    ├── integration/
    │   ├── content/
    │   │   ├── prisma-content.repository.spec.ts
    │   │   └── content.controller.integration.spec.ts
    │   └── ...
    └── e2e/
        └── flows/
            ├── publish-flow.e2e.spec.ts
            └── ...
```

---

## 8. Frontend Test Strategy (Reactive)

### 8.1 Test Strategy by Frontend Layer

```
┌─────────────────────────────────────────────────────────────────────┐
│  REACTIVE LAYER              │  TEST LEVEL        │  TARGET COVERAGE │
├──────────────────────────────┼───────────────────┼──────────────────┤
│  Pure logic (reducers,       │  Unit              │  100% / 100%     │
│  selectors, utils)            │                    │                  │
│  RxJS streams                │  Marble (unit)     │  100% / ≥98%     │
│  Hooks (useQuery, mutations) │  Hook (RTL + MSW)  │  ≥95% / ≥95%     │
│  Presentational components   │  Render + interact │  ≥95% / ≥90%     │
│  Container components        │  Integration (MSW) │  ≥95% / ≥90%     │
│  Design system primitives    │  Unit + Storybook  │  ≥98% / ≥95%     │
│  App shell                   │  E2E only          │  excluded        │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Pure Logic Testing

Reducers, selectors, mappers, formatters — all pure. Tested with Vitest at unit level.

```typescript
describe('contentListSelectors.filteredByStatus', () => {
  const items = [
    aContent({ status: 'draft' }),
    aContent({ status: 'published' }),
    aContent({ status: 'published' }),
  ];

  it('returns only items matching the status', () => {
    const result = filteredByStatus(items, 'published');
    expect(result).toHaveLength(2);
    expect(result.every(i => i.status === 'published')).toBe(true);
  });

  it('returns all items when status is "all"', () => {
    expect(filteredByStatus(items, 'all')).toHaveLength(3);
  });

  it('does not mutate input', () => {
    const before = [...items];
    filteredByStatus(items, 'published');
    expect(items).toEqual(before);
  });
});
```

### 8.3 RxJS Stream Testing (Marble Tests)

Use `TestScheduler` for virtual time. Express stream behavior in marble syntax.

```typescript
describe('autosave$', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  it('debounces form changes by 30 seconds', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const input$  = cold('--a--b--c----------d|', { a: f1, b: f2, c: f3, d: f4 });
      //                       ^^^^^^^^   ^^^^^^^^
      // First burst ends with 'c'; after 30s of no activity, c saves.
      // Then 'd' arrives later, debounce again.
      const saveApi = vi.fn().mockResolvedValue({ saved: true });
      const result$ = makeAutosave(input$, saveApi, { debounceMs: 30_000 });

      expectObservable(result$).toBe(
        '--------------------------(s|)--------------------------(s|)',
        { s: { kind: 'saved' } },
      );
    });
  });

  it('cancels in-flight save when new change arrives', () => {
    // ... marble test verifying switchMap semantics
  });

  it('emits error state when save fails', () => {
    // ... marble test for error path
  });
});
```

### 8.4 Hook Testing

For hooks that wrap `useQuery` / `useMutation`, use **MSW** to mock HTTP at the network layer (no fetching real APIs, no mocking fetch).

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('/api/admin/content', () =>
    HttpResponse.json({
      data: [{ id: '1', title: 'Hello', status: 'published' }],
      pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
    }),
  ),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useContentList', () => {
  it('returns content from the API', async () => {
    const { result } = renderHook(() => useContentList({ status: 'published' }), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={new QueryClient()}>
          {children}
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].title).toBe('Hello');
  });

  it('exposes error state on 5xx response', async () => {
    server.use(
      http.get('/api/admin/content', () => HttpResponse.json({}, { status: 500 })),
    );

    const { result } = renderHook(() => useContentList({}), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

### 8.5 Component Testing

#### 8.5.1 Presentational Components

Test rendering and accessibility. No state mocking — only props.

```typescript
describe('StatusChip', () => {
  it.each([
    ['draft',       'Draft',       /Status: Draft/],
    ['in_review',   'In Review',   /Status: In Review/],
    ['published',   'Published',   /Status: Published/],
  ])('renders %s correctly', (status, label, srText) => {
    render(<StatusChip status={status as ContentStatus} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(srText)).toBeInTheDocument(); // hidden status for SR
  });

  it('is keyboard focusable when interactive prop is true', async () => {
    const onClick = vi.fn();
    render(<StatusChip status="draft" onClick={onClick} />);
    const chip = screen.getByRole('button');
    await userEvent.tab();
    expect(chip).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalled();
  });
});
```

#### 8.5.2 Container Components

Render with real providers (QueryClient, Theme, Router); mock backend with MSW.

```typescript
describe('ContentListPage', () => {
  it('shows the list and lets the user filter by status', async () => {
    server.use(/* ... */);
    renderWithProviders(<ContentListPage />);

    await screen.findByText('My Article');
    await userEvent.click(screen.getByRole('button', { name: /Filter: All/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Published' }));

    await waitFor(() => {
      expect(screen.queryByText('Draft Article')).not.toBeInTheDocument();
      expect(screen.getByText('Published Article')).toBeInTheDocument();
    });
  });

  it('navigates to the editor when a row is clicked', async () => {
    server.use(/* ... */);
    renderWithProviders(<ContentListPage />, { route: '/content' });

    const row = await screen.findByText('My Article');
    await userEvent.click(row);
    await waitFor(() => expect(window.location.pathname).toMatch(/\/content\/[a-z0-9-]+/));
  });
});
```

### 8.6 Visual Regression (Storybook + Chromatic)

- Design system primitives have Storybook stories with all states.
- Key screens (login, editor, dashboard) have stories with representative data.
- Chromatic compares snapshots on every PR; visual diffs require review approval.

### 8.7 Accessibility Testing

- Every component test includes an `axe` automated scan.
- All interactive flows verified with keyboard-only navigation in E2E.
- Screen reader testing (NVDA / VoiceOver) on critical flows before each release.

```typescript
import { axe } from 'vitest-axe';

it('content editor has no accessibility violations', async () => {
  const { container } = render(<ContentEditor />);
  expect(await axe(container)).toHaveNoViolations();
});
```

### 8.8 Frontend Test Folder Structure

```
frontend/
├── src/
│   ├── features/
│   │   └── content/
│   │       ├── pages/ContentListPage.tsx
│   │       ├── pages/ContentListPage.spec.tsx       ← co-located
│   │       ├── components/StatusChip.tsx
│   │       ├── components/StatusChip.spec.tsx
│   │       ├── streams/autosave.stream.ts
│   │       └── streams/autosave.stream.spec.ts      ← marble
│   └── design-system/
│       └── components/Button/
│           ├── Button.tsx
│           ├── Button.spec.tsx
│           └── Button.stories.tsx                   ← Storybook
└── test/
    ├── mocks/
    │   ├── server.ts                                 ← MSW server
    │   └── handlers.ts                               ← MSW handlers
    ├── builders/
    │   └── a-content.ts                              ← FE test builders
    ├── utils/
    │   └── render-with-providers.tsx
    └── e2e/
        └── flows/
            ├── publish-flow.e2e.spec.ts
            └── ...
```

---

## 9. Integration & End-to-End Strategy

### 9.1 Contract Testing (FE ↔ BE)

**Source of truth**: OpenAPI 3.1 spec generated from BE decorators.

**Process**:

1. BE generates `openapi.json` as part of build.
2. CI fails if `openapi.json` differs from the committed copy.
3. FE generates TypeScript types from the committed `openapi.json` at build time.
4. A separate "contract drift" check compares the implementation output to the committed spec.

This ensures FE and BE cannot drift apart without a deliberate, reviewed change to the spec.

### 9.2 End-to-End Test Strategy

#### 9.2.1 E2E Scope

E2E covers the **critical user journeys** end to end. It is NOT for testing every screen or every error case — those belong in lower layers.

#### 9.2.2 E2E Flows in MVP

| ID    | Flow                                                            | Owner Module      |
| ----- | --------------------------------------------------------------- | ----------------- |
| E2E-01| Admin invites user → user accepts → user logs in                 | auth, users       |
| E2E-02| Editor logs in → creates draft → submits → publishes → appears in public API | content |
| E2E-03| Author submits for review → editor rejects with note → author edits → editor approves | content |
| E2E-04| Editor unpublishes article → disappears from public API within 60s | content, public-api |
| E2E-05| Author uploads image → embeds in article → publishes → image visible publicly | media, content |
| E2E-06| User wrong password 5 times → locked → waits → can log in     | auth              |
| E2E-07| User clicks forgot password → receives email → resets → logs in | auth            |
| E2E-08| Admin creates API key → fetches public articles with it → revokes → fetch fails | auth, public-api |
| E2E-09| Editor schedules article for future → time passes → auto-publishes | content       |
| E2E-10| Admin deactivates user → user is logged out → cannot log back in | auth, users     |

#### 9.2.3 E2E Implementation Rules

- One spec file per flow.
- Use **Page Object Model**: each page in `e2e/pages/`.
- Avoid CSS selectors; use `data-testid`, ARIA roles, and accessible names.
- Test data created via test API endpoints (factory routes) or direct DB seeding — never via UI for setup.
- Each test cleans up its own data (or runs in an isolated tenant/seed).
- No `setTimeout` / `sleep`; use Playwright auto-waiting and explicit `waitFor` conditions.

#### 9.2.4 E2E Example

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage, ContentListPage, ContentEditorPage } from './pages';

test.describe('Publish flow', () => {
  test('Editor publishes a draft and it appears in public API', async ({ page, request }) => {
    const editor = await createEditor();
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(editor.email, editor.password);

    const list = new ContentListPage(page);
    await list.waitForLoad();
    await list.clickNewArticle();

    const editor_ = new ContentEditorPage(page);
    await editor_.setTitle('E2E Test Article');
    await editor_.setBody('Lorem ipsum.');
    await editor_.setSeoDescription('A test article for E2E coverage.');
    await editor_.publish();

    await expect(editor_.statusChip).toHaveText('Published');

    // Verify it actually appears in the public API
    const apiKey = await issueApiKey();
    const response = await request.get('/api/v1/articles', {
      headers: { 'X-API-Key': apiKey },
    });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data.some((a: any) => a.title === 'E2E Test Article')).toBe(true);
  });
});
```

### 9.3 Smoke Tests (Post-Deploy)

A subset of E2E that runs immediately after deploy in the target environment. Goal: detect catastrophic deploy issues in < 3 minutes.

| Smoke check              | What it verifies                          |
| ------------------------ | ----------------------------------------- |
| Admin login              | Auth + DB connectivity                    |
| Fetch published articles | Public API + DB read                      |
| Create + publish article | Full write path                           |
| Media upload presign     | S3 connectivity                           |
| Health endpoint          | Service is alive                          |

Failure of smoke = automatic rollback (Quality Gate G-08 in 05-METRICS).

---

## 10. Non-Functional Test Strategy

### 10.1 Performance Testing

#### 10.1.1 Performance Test Types

| Type           | Goal                                                     | Frequency             |
| -------------- | -------------------------------------------------------- | --------------------- |
| Load           | Verify P95 latency targets at expected load              | Weekly (staging)       |
| Stress         | Find breaking point                                      | Pre-release           |
| Spike          | Behavior under sudden load increase                       | Pre-release           |
| Soak           | 8h+ steady load to detect leaks                          | Monthly               |
| Baseline       | Track latency over time                                  | Every deploy (k6 short run) |

#### 10.1.2 Performance Targets (from 02-SRS and 05-METRICS)

| Metric                                  | Target          |
| --------------------------------------- | --------------- |
| Public API P95 (cached)                 | ≤ 200 ms        |
| Public API P95 (uncached)               | ≤ 600 ms        |
| Admin API mutation P95                  | ≤ 800 ms        |
| Sustained RPS on public API             | ≥ 200 RPS       |
| Error rate under load                   | ≤ 0.1%          |
| Admin SPA LCP                           | ≤ 2.5 s         |
| Admin SPA INP                           | ≤ 200 ms        |

#### 10.1.3 Tools

- **k6** for HTTP load testing.
- **Lighthouse CI** for frontend Web Vitals on every PR.
- **web-vitals** library in production for Real User Monitoring.

### 10.2 Security Testing

#### 10.2.1 Continuous (Per PR)

- Dependency CVE scan (Snyk / Dependabot).
- SAST (Semgrep + CodeQL).
- Secret scan (gitleaks).
- Container scan (Trivy on built image).
- Authorization matrix tests (custom test suite covering all role × action combinations).
- XSS payload corpus tests against the sanitizer.
- SQL injection tests via parameterized query verification (we use Prisma; no string concatenation allowed).

#### 10.2.2 Periodic

- Penetration test by external vendor — pre-launch and annually.
- Threat model review — quarterly.
- Incident response drill — annually.

#### 10.2.3 Authorization Matrix Test

For every protected endpoint, a parameterized test verifies:

```typescript
describe.each([
  // [role,   method, path,                              expected]
  ['admin',   'POST', '/api/admin/users',                201],
  ['editor',  'POST', '/api/admin/users',                403],
  ['author',  'POST', '/api/admin/users',                403],
  ['admin',   'POST', '/api/admin/content/:id/publish',  200],
  ['editor',  'POST', '/api/admin/content/:id/publish',  200],
  ['author',  'POST', '/api/admin/content/:id/publish',  403],
  // ... full matrix
])('authz: %s %s %s', (role, method, path, expected) => {
  it(`returns ${expected}`, async () => {
    // ... call endpoint with that role, assert status
  });
});
```

### 10.3 Accessibility Testing

#### 10.3.1 Continuous

- `axe-core` automated scan in every component test.
- Lighthouse a11y score ≥ 95 in CI.

#### 10.3.2 Pre-Release

- Manual keyboard-only navigation through all primary flows.
- Screen reader (NVDA on Windows, VoiceOver on macOS) walkthrough of: login, content list, content editor, media library.
- Color contrast verified on dark mode.
- `prefers-reduced-motion` respected.

### 10.4 Compatibility Testing

#### 10.4.1 Browser Matrix

| Browser  | Versions                | Tier      |
| -------- | ----------------------- | --------- |
| Chrome   | Latest 2 stable         | Tier 1 (full E2E) |
| Edge     | Latest 2 stable         | Tier 1    |
| Firefox  | Latest 2 stable         | Tier 1    |
| Safari   | Latest 2 stable (macOS) | Tier 1    |
| Safari iOS | Latest                | Tier 2 (smoke only) |

#### 10.4.2 Viewport Matrix

| Viewport          | Tier              |
| ----------------- | ----------------- |
| 1920×1080 desktop | Tier 1 (full E2E) |
| 1440×900 laptop   | Tier 1            |
| 1280×800 small laptop | Tier 1        |
| 768×1024 tablet   | Tier 2 (smoke)    |
| Mobile (<600 dp)  | Tier 3 (functional only; not optimized) |

### 10.5 Localization-Readiness

While localization itself is out of MVP scope, tests enforce:

- No hardcoded user-facing strings outside i18n resource files (ESLint rule).
- Dates rendered through formatter (no `toString()`).
- All data stored as UTF-8 (DB collation + content-type headers).
- Date inputs accept ISO 8601.

---

## 11. Test Data Management

### 11.1 Test Data Categories

| Category         | Description                                                 | Where                          |
| ---------------- | ----------------------------------------------------------- | ------------------------------ |
| Test fixtures    | Fixed JSON / SQL files for repeatable scenarios             | `test/fixtures/`               |
| Test builders    | Code that constructs valid objects with sensible defaults   | `test/builders/`               |
| Test factories   | Factories that persist objects (for integration / E2E)       | `test/factories/`              |
| Snapshot fixtures| Stored output for snapshot tests                            | `test/__snapshots__/`          |
| Seed data        | Realistic data for staging / demo                           | `prisma/seeds/`                |

### 11.2 Test Data Builders (Pattern)

Builders provide concise, readable test setup:

```typescript
// test/builders/a-content.ts
export function aContent(overrides: Partial<ContentProps> = {}): Content {
  return Content.create({
    id: ContentId.from(crypto.randomUUID()),
    type: 'article',
    title: 'Default Test Title',
    slug: Slug.create('default-test-title'),
    body: RichTextBody.empty(),
    status: 'draft',
    authorId: UserId.from('00000000-0000-0000-0000-000000000001'),
    seo: SeoMetadata.create({ description: 'A default description for testing.' }),
    tags: [],
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    ...overrides,
  });
}
```

Tests then read clearly:

```typescript
const draft = aContent({ status: 'draft' });
const published = aContent({ status: 'published', publishedAt: new Date('...') });
```

### 11.3 Data Isolation Rules

- **Unit tests**: Each test creates its own data inside the test function. No shared mutable state.
- **Integration tests**: Each test truncates affected tables (or runs in a transaction that rolls back).
- **E2E tests**: Each test creates data via API factory endpoints with unique identifiers (e.g., email = `e2e-${uuid}@example.com`). Cleanup is best-effort; nightly job sweeps stale E2E data.

### 11.4 Sensitive Data in Tests

- **Real production data is NEVER used in tests or non-production environments.**
- Synthetic data only.
- Email addresses use the `@example.com` domain to avoid accidental delivery.
- Phone numbers use the `+1-555-0100` test range.
- Any PII fixture is reviewed and approved by security.

### 11.5 Time and Randomness Control

- Backend domain code receives time via injected `Clock` port.
- Tests inject `FakeClock` with deterministic times.
- IDs generated via injected `IdGenerator` port; tests inject sequential or fixed generators.
- Frontend tests use `vi.useFakeTimers()` for time-sensitive logic.
- RxJS streams use `TestScheduler` for virtual time.

---

## 12. Test Environments

### 12.1 Environment Matrix

| Environment   | Purpose                          | Data          | Refreshed         |
| ------------- | -------------------------------- | ------------- | ----------------- |
| Local         | Developer machines               | Synthetic     | On demand         |
| CI            | Per-PR automated tests           | Ephemeral (Testcontainers) | Per run |
| Dev           | Continuous integration deployment | Synthetic    | On every merge to main |
| Staging       | Pre-production, UAT, perf tests  | Sanitized realistic | Weekly       |
| Production    | Live                             | Real          | n/a               |

### 12.2 Environment Parity

- All environments use the **same container image** built once and promoted (no rebuilding).
- Configuration differs only via environment variables and secrets.
- Database engine version, Redis version, S3 provider must match staging ↔ production.

### 12.3 Test Database Strategy

| Test Level    | Database                                       |
| ------------- | ---------------------------------------------- |
| Unit          | None (no DB)                                   |
| Integration   | Testcontainers Postgres, one container per test file (or shared with isolated schemas) |
| E2E           | Real Postgres in the dev/staging environment   |
| Manual        | Staging                                        |

---

## 13. Test Automation Architecture

### 13.1 Test Stack Overview

```
┌────────────────────────────────────────────────────────────┐
│  CI / CD (GitHub Actions)                                   │
│  - Per-PR pipeline runs all gates (see 05-METRICS §11)      │
└─────────────────────┬──────────────────────────────────────┘
                      │
   ┌──────────────────┼──────────────────┐
   ▼                  ▼                  ▼
┌──────────┐    ┌──────────┐      ┌──────────┐
│  Unit    │    │Integration│      │   E2E    │
│ Vitest   │    │ Vitest +  │      │Playwright│
│          │    │Testcontnr │      │          │
└─────┬────┘    └─────┬────┘      └─────┬────┘
      │               │                  │
      └───────┬───────┴──────────────────┘
              │
              ▼
       ┌──────────────┐
       │  Coverage    │   c8 / Istanbul
       │  Reports     │   → uploaded to Codecov
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │  Mutation    │   Stryker
       │  Testing     │   (changed files per PR; full nightly)
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │  Quality     │   See 05-METRICS §11
       │  Gates       │
       └──────────────┘
```

### 13.2 Page Object Model (E2E)

Each Playwright page maps to a real screen and exposes intentful methods.

```typescript
// test/e2e/pages/content-editor.page.ts
export class ContentEditorPage {
  constructor(private readonly page: Page) {}

  get titleInput()   { return this.page.getByRole('textbox', { name: 'Title' }); }
  get statusChip()   { return this.page.getByTestId('status-chip'); }

  async setTitle(value: string)            { await this.titleInput.fill(value); }
  async setBody(value: string)             { await this.page.getByRole('textbox', { name: 'Body' }).fill(value); }
  async setSeoDescription(value: string)   { await this.page.getByRole('textbox', { name: 'Meta Description' }).fill(value); }
  async publish()                          { await this.page.getByRole('button', { name: 'Publish' }).click(); }
  async waitForAutoSaved()                 { await this.page.getByText(/Saved \d+ seconds? ago/).waitFor(); }
}
```

### 13.3 Test Helpers

Common helpers live in `test/utils/`:

- `renderWithProviders` (FE) — wraps component in Query, Theme, Router.
- `loginAs` (BE integration / FE E2E) — authenticates a test user.
- `seedContent`, `seedUser` — factory routes for tests.
- `withFakeClock` — runs a test with a controlled clock.
- `withApp` — boots the BE app for integration tests.

### 13.4 Test Isolation & Parallelization

- Unit tests run in parallel (Vitest default).
- Integration tests run in parallel where each test owns its DB schema.
- E2E tests run in parallel browser workers; each test creates uniquely-prefixed data.
- No shared mutable globals.

---

## 14. Defect Management

### 14.1 Defect Lifecycle

```
Reported → Triaged → Reproduced → Test Written (red) → Fixed (green) → Verified → Closed
```

Every defect with a status of "Reproduced" results in a **failing regression test before the fix is written**. The fix turns the test green. The test stays in the suite forever.

### 14.2 Defect Severity & Priority

| Severity | Definition                                  | Target Fix Time  |
| -------- | ------------------------------------------- | ---------------- |
| S1       | Production down, data loss, security breach | < 4 hours        |
| S2       | Major feature broken, no workaround         | < 1 business day |
| S3       | Feature impaired, workaround exists         | Next sprint      |
| S4       | Cosmetic / minor                            | Backlog          |

| Priority | Definition                                        |
| -------- | ------------------------------------------------- |
| P1       | Fix now                                            |
| P2       | Fix this sprint                                    |
| P3       | Fix next sprint                                    |
| P4       | Fix when convenient                                |

### 14.3 Bug Report Template

```markdown
**Title**: [feature] short description

**Severity**: S1 / S2 / S3 / S4
**Priority**: P1 / P2 / P3 / P4
**Environment**: prod / staging / dev / local

**Steps to reproduce**:
1.
2.
3.

**Expected**:
**Actual**:

**Evidence**: screenshots, logs, request ID

**Regression test plan**: where the failing test will live
```

### 14.4 Definition of Fixed

A defect is "Fixed" when:

1. A regression test exists and was failing before the fix.
2. The test now passes.
3. All existing tests still pass.
4. Code review approved.
5. Verified in staging by reporter (or QA proxy).

---

## 15. Roles & Responsibilities

### 15.1 RACI Matrix

| Activity                             | Dev | QA | Tech Lead | DevOps | PO |
| ------------------------------------ | --- | -- | --------- | ------ | -- |
| Write unit tests (TDD)               | R/A | C  | A         |        |    |
| Write integration tests              | R/A | C  | A         |        |    |
| Maintain in-memory fakes             | R/A | C  | A         |        |    |
| Write E2E tests                      | R   | R/A| A         |        | C  |
| Maintain CI pipeline                 | C   | C  | A         | R      |    |
| Performance test design               | C   | R  | A         | C      | C  |
| Security test review                 | C   | C  | A         | C      | I  |
| Accessibility test                   | R   | R/A| A         |        | C  |
| Defect triage                        | C   | R  | A         |        | C  |
| Test data management                 | R/A | C  | A         | C      |    |
| Test environment health              | C   | C  | A         | R/A    |    |
| Sign-off on release                  | C   | R  | R         | C      | A  |

R = Responsible · A = Accountable · C = Consulted · I = Informed

### 15.2 Development Team

- Practice TDD on every feature.
- Maintain ≥ 98% coverage on owned modules.
- Keep tests fast, deterministic, isolated.
- Write E2E tests for new user flows.

### 15.3 QA Engineering

- Own test strategy execution and reporting.
- Author and maintain E2E suite and Page Objects.
- Drive performance and accessibility testing.
- Run exploratory sessions before releases.
- Triage defects.

### 15.4 Tech Lead

- Approve waivers on quality gates.
- Review test pyramid balance quarterly.
- Champion TDD discipline.
- Audit coverage exclusions.

### 15.5 DevOps

- Maintain CI/CD pipeline, test environments.
- Ensure Testcontainers/k6/Playwright run reliably.
- Provide test data refresh tooling for staging.

---

## 16. Tools & Infrastructure

### 16.1 Tooling Summary

| Concern                  | Tool                                         |
| ------------------------ | -------------------------------------------- |
| BE test runner           | Vitest                                       |
| FE test runner           | Vitest                                       |
| Component testing (FE)   | React Testing Library                        |
| HTTP mocking (FE)        | MSW (Mock Service Worker)                    |
| Hook testing             | `@testing-library/react`                     |
| Stream testing           | `rxjs/testing` TestScheduler                 |
| BE integration DB        | Testcontainers (Postgres)                    |
| BE integration cache     | Testcontainers (Redis)                       |
| BE HTTP integration       | Supertest + NestJS Test                     |
| Contract / OpenAPI       | `openapi-typescript`, Spectral lint           |
| E2E                      | Playwright                                   |
| Visual regression         | Storybook + Chromatic                       |
| Accessibility (auto)     | axe-core, vitest-axe, @axe-core/playwright   |
| Accessibility (manual)   | NVDA (Windows), VoiceOver (macOS)            |
| Mutation testing         | Stryker                                      |
| Property-based testing   | fast-check                                   |
| Coverage                 | c8 / Istanbul                                |
| Performance              | k6, Lighthouse CI, web-vitals                |
| SAST                     | Semgrep, CodeQL                              |
| Dependency vulns         | Snyk, Dependabot                             |
| Secrets                  | gitleaks                                     |
| Container scan           | Trivy                                        |
| Architecture conformance | dependency-cruiser, ts-arch                  |
| Lint / Format            | ESLint, Prettier                             |
| CI                       | GitHub Actions                               |
| Reporting / Dashboard    | Codecov, Stryker Dashboard, Grafana          |

### 16.2 Test Infrastructure Requirements

- CI runners with sufficient CPU (Vitest parallel + Testcontainers).
- Docker available in CI for Testcontainers.
- 8 GB RAM minimum per CI runner.
- Playwright browsers pre-installed in a custom CI image to save install time.
- Cached node_modules / pnpm store between runs.

---

## 17. Test Deliverables

### 17.1 Per-PR Deliverables

- Test report (pass/fail per layer).
- Coverage report (overall + diff).
- Mutation score report (changed files).
- Performance regression report (Lighthouse CI).
- Security scan summary.
- Posted as PR comment (template in 05-METRICS §14.1).

### 17.2 Per-Release Deliverables

- Test execution summary across all levels.
- Final coverage report.
- Performance test results vs targets.
- Security scan certification.
- Accessibility audit summary.
- List of known defects (open + deferred).
- Test environment versions used.

### 17.3 Living Documents

- This test strategy — updated when patterns evolve.
- Test pyramid metrics dashboard — real-time.
- Flaky test report — weekly.

---

## 18. Risks & Mitigations

| ID    | Risk                                                                | Impact | Likelihood | Mitigation                                                                 |
| ----- | ------------------------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------- |
| TR-01 | Team unfamiliar with TDD; productivity dip in first weeks           | Medium | High       | Pair programming, code katas, tech lead coaching for first month           |
| TR-02 | 98% coverage encourages low-quality tests to hit number             | High   | Medium     | Mutation testing 80% gate prevents coverage gaming                         |
| TR-03 | Flaky E2E tests erode trust                                          | High   | Medium     | Strict flake budget (≤ 0.5%); auto-quarantine after 2 flakes; weekly review |
| TR-04 | Slow test suite slows down development                               | Medium | Medium     | Suite duration budgets; parallelize; profile slowest tests monthly          |
| TR-05 | Integration tests depend on real DB and become flaky                | Medium | Medium     | Per-test transaction rollback; Testcontainers per test file                |
| TR-06 | Coverage tooling miscounts (e.g., TS transpilation)                  | Medium | Low        | Use v8 coverage provider; verify on sample modules                          |
| TR-07 | Test data drift between environments                                 | Medium | Medium     | Builders + factories codified; staging reset weekly                         |
| TR-08 | Critical paths overlooked when defining "critical"                   | High   | Low        | Quarterly review of critical path list with security + product            |
| TR-09 | Mutation testing too slow to gate every PR                          | Medium | Medium     | Run incrementally on changed files in PR; full suite nightly only         |
| TR-10 | Tests coupled to implementation, breaking on safe refactor          | High   | Medium     | Code review checklist item; fakes (not mocks) preferred; test names describe behavior |
| TR-11 | Manual accessibility testing skipped under time pressure            | High   | Medium     | Block release without sign-off; track in release checklist                 |
| TR-12 | E2E coverage too broad (testing what unit should test)              | Medium | High       | Tech lead reviews new E2E tests; reject if testable lower                  |

---

## 19. Appendices

### 19.1 Appendix A — Test Naming Convention

Use sentence-style test names that describe behavior:

✅ Good:
- `should reject publish when SEO description is missing`
- `returns 403 when an author tries to publish another user's article`
- `debounces autosave by 30 seconds`

❌ Bad:
- `test publish`
- `publish works`
- `it 1`

### 19.2 Appendix B — AAA Test Structure

Every test follows **Arrange → Act → Assert**, separated by blank lines:

```typescript
it('publishes a draft when the actor is an editor', async () => {
  // Arrange
  const editor = aUser({ role: 'editor' });
  const draft  = aContent({ status: 'draft', authorId: editor.id });
  await users.save(editor);
  await contents.save(draft);

  // Act
  const result = await useCase.execute({ contentId: draft.id, actorId: editor.id });

  // Assert
  expect(result.status).toBe('published');
  expect(events.published).toHaveLength(1);
});
```

### 19.3 Appendix C — Test Review Checklist

PRs introducing new tests are reviewed against:

- [ ] Test name describes behavior, not implementation.
- [ ] AAA structure visible.
- [ ] No shared mutable state between tests.
- [ ] No `Math.random`, `new Date()` without injection.
- [ ] No `sleep` / arbitrary timeouts.
- [ ] No assertions on internal methods called.
- [ ] Builders used for test data setup.
- [ ] Fakes used for outbound ports (not mocks).
- [ ] Property-based tests considered for value objects / pure utilities.
- [ ] Critical path additions raise critical path coverage list awareness.
- [ ] At the right level (no E2E for what unit could cover).

### 19.4 Appendix D — Critical Path Test Inventory

(Mirrors 05-METRICS Appendix D; this is the authoritative version maintained here.)

| Critical Path                              | Required Test File(s)                                       |
| ------------------------------------------ | ----------------------------------------------------------- |
| Login + JWT issuance                       | `auth/application/use-cases/login.use-case.spec.ts`<br>`auth/adapters/in/http/auth.controller.integration.spec.ts` |
| Refresh rotation + reuse detection         | `auth/application/use-cases/refresh-token.use-case.spec.ts` + e2e flow |
| Account lockout                            | `auth/application/use-cases/login.use-case.spec.ts` (lockout cases)<br>`auth/adapters/in/rate-limit.guard.spec.ts` |
| Password hash + verify                     | `auth/adapters/out/crypto/argon2-password-hasher.spec.ts`   |
| RBAC permission checks                     | per-module `application/policies/*.policy.spec.ts` + authz matrix |
| Content lifecycle transitions              | `content/domain/services/content-lifecycle.service.spec.ts` |
| Publish requirements                        | `content/domain/services/publish-requirements-checker.spec.ts` |
| Public API visibility filter                | `public-api/application/use-cases/list-published-content.spec.ts`<br>`public-api/adapters/in/http/articles.controller.integration.spec.ts` |
| Rich text sanitization                     | `content/application/sanitizer.service.spec.ts` (full XSS corpus) |
| Media upload validation                     | `media/application/use-cases/finalize-media.use-case.spec.ts` |
| Audit append-only                          | `audit/adapters/out/persistence/prisma-audit.repository.spec.ts` |
| Soft delete + hard delete job              | `content/application/use-cases/delete-content.use-case.spec.ts`<br>`content/application/jobs/hard-delete-job.spec.ts` |
| API key create + hash + revoke             | `auth/application/use-cases/create-api-key.use-case.spec.ts`<br>`auth/application/use-cases/revoke-api-key.use-case.spec.ts` |

### 19.5 Appendix E — Traceability (Requirements → Tests)

| Req ID         | Source         | Verified By (test layer)               |
| -------------- | -------------- | -------------------------------------- |
| FR-AUTH-01..10 | 02-SRS §5.1    | unit + integration + E2E-01, E2E-06, E2E-07 |
| FR-USER-01..08 | 02-SRS §5.2    | unit + integration + E2E-01, E2E-10    |
| FR-AUTHZ-01..06| 02-SRS §5.3    | authz matrix tests + per-use-case unit |
| FR-CONTENT-01..16 | 02-SRS §5.4 | unit + integration + E2E-02, E2E-03, E2E-04, E2E-09 |
| FR-MEDIA-01..08 | 02-SRS §5.5   | unit + integration + E2E-05            |
| FR-SEO-01..03  | 02-SRS §5.6    | unit (content entity)                  |
| FR-AUDIT-01..06| 02-SRS §5.7    | integration (append-only) + E2E (audit log appears) |
| FR-PUBAPI-01..07 | 02-SRS §5.8  | integration + E2E-02, E2E-08           |
| NFR-PERF-*     | 02-SRS §8.1    | k6 load tests + Lighthouse CI          |
| NFR-AVAIL-*    | 02-SRS §8.3    | DR drills, monitoring                  |
| SEC-*          | 02-SRS §9      | SAST + dependency scans + authz matrix + pentest |

A complete matrix is maintained in the issue tracker, linking each Jira issue (with FR/UR ID custom field) to its verifying test file(s).

### 19.6 Appendix F — Glossary

| Term                | Definition                                                       |
| ------------------- | ---------------------------------------------------------------- |
| TDD                 | Test-Driven Development: red → green → refactor                  |
| AAA                 | Arrange / Act / Assert — test structure                          |
| Fake                | A working implementation of an interface, used in tests instead of a real one |
| Mock                | An object that records interactions for later verification       |
| Stub                | An object that returns canned responses                          |
| SUT                 | System Under Test                                                |
| MSW                 | Mock Service Worker (intercepts HTTP at the network layer)       |
| Marble test         | RxJS test using ASCII timeline notation                          |
| Mutation testing    | Inject changes to production code; verify tests fail (catch the mutant) |
| Property-based test | Generates many input cases from a property to find edge cases    |
| Critical path       | Code path where bugs cause severe harm                           |
| Test pyramid        | Many unit, some integration, few E2E                             |
| Flaky test          | A test that fails intermittently without code changes            |
| Coverage gate       | Automated check that fails CI if coverage drops below threshold  |

### 19.7 Appendix G — Document Change Log

| Version | Date       | Author | Change                                  |
| ------- | ---------- | ------ | --------------------------------------- |
| 1.0     | 2026-05-11 | —      | Initial test strategy                   |

---

**End of Document**
