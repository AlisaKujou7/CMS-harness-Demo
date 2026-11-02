# METRICS.md — Software Architecture Metrics & Quality Gates

## Content Management System (CMS) — MVP

| Field             | Value                                            |
| ----------------- | ------------------------------------------------ |
| Document Type     | Architecture Metrics & Quality Gate Spec         |
| Document Version  | 1.0                                              |
| Status            | Draft                                            |
| Date              | 2026-05-11                                       |
| Classification    | Internal                                         |
| Development Model | Test-Driven Development (TDD)                    |
| Coverage Target   | **98% line / 98% branch / 100% critical paths**  |
| Companion Docs    | 01-Requirements-Specification.md, 02-Software-Requirements-Specification.md, 03-DESIGN.md, 04-ARCH.md |

---

## Table of Contents

1. Introduction
2. TDD Development Discipline
3. Coverage Strategy (98%)
4. Architecture Metrics — Backend (Hexagonal)
5. Architecture Metrics — Frontend (Reactive)
6. Code Quality Metrics
7. Test Quality Metrics
8. Security & Dependency Metrics
9. Performance & Reliability Metrics
10. Process & Delivery Metrics
11. Quality Gates — Definitions & Thresholds
12. Gate Enforcement in CI/CD Pipeline
13. Tooling Matrix
14. Reporting & Dashboards
15. Exceptions & Waivers
16. Appendices

---

## 1. Introduction

### 1.1 Purpose

This document defines **measurable quality criteria** and **automated quality gates** for the CMS MVP. It binds the architecture decisions in `04-ARCH.md` to concrete metrics and enforces them through CI/CD pipelines.

All metrics in this document are **enforced**, not aspirational. A pull request that fails any gate cannot merge to `main`.

### 1.2 Scope

| In Scope                                          | Out of Scope                              |
| ------------------------------------------------- | ----------------------------------------- |
| TDD discipline and metrics                        | Team productivity metrics (story points)  |
| Code coverage (line, branch, mutation, path)      | Developer performance reviews             |
| Architecture conformance metrics                  | Business KPIs (already in Requirements)   |
| Code quality (complexity, duplication, debt)      | UX metrics                                |
| Security and dependency posture                   | Marketing analytics                       |
| Quality gate thresholds                           | Cost metrics                              |
| CI/CD enforcement                                 |                                           |

### 1.3 Why 98% Coverage

98% is a deliberate choice between "high enough to catch nearly everything" and "100% which forces tests for trivial code that adds noise." The remaining 2% is reserved for:

- Generated code (Prisma client, OpenAPI types) — excluded from coverage scope.
- Logging-only branches.
- Defensive `default` clauses on exhaustive switch statements that are unreachable by type system.

**Critical paths** (auth, authorization, content lifecycle, public API gating) must hit **100%** with both line and branch coverage plus **mutation testing ≥ 80%**.

### 1.4 Guiding Principles

1. **Tests are part of the design, not an afterthought.** TDD shapes the architecture.
2. **Coverage is a side effect of good tests, not the target.** A 98% gate prevents *regression*, not low-quality tests.
3. **Mutation testing validates that tests actually assert behavior**, not just execute code.
4. **Every metric must be automatically measurable.** If we can't measure it in CI, it isn't a gate.
5. **Gates fail fast.** Lint and types before tests; unit before integration.

---

## 2. TDD Development Discipline

### 2.1 The TDD Cycle (Mandatory)

Every production code change follows the **Red → Green → Refactor** cycle:

```
   ┌───────────────────────────────────────────┐
   │                                            │
   │   1. RED    Write a failing test           │
   │             that describes the next         │
   │             smallest behavior               │
   │                                            │
   │   2. GREEN  Write the minimum code to       │
   │             make the test pass              │
   │                                            │
   │   3. REFACTOR  Improve structure without    │
   │                changing behavior; tests     │
   │                stay green                   │
   │                                            │
   └───────────────────────────────────────────┘
                         ▲
                         │ Repeat
                         │ smallest steps
```

### 2.2 TDD Rules of Engagement

| # | Rule                                                                       |
| - | -------------------------------------------------------------------------- |
| 1 | No production code is written without a failing test that requires it.     |
| 2 | Write only enough of a test to fail; compilation failures count as failures. |
| 3 | Write only enough production code to pass the current failing test.        |
| 4 | Refactor only when tests are green.                                         |
| 5 | Commits should be small and frequent; aim for a green-on-merge commit every 10–30 minutes. |
| 6 | New bug fix → write a failing test that reproduces the bug FIRST, then fix.|
| 7 | When unsure where to start, write the test for the public behavior, not the implementation detail. |

### 2.3 Test First, Always

The CI pipeline enforces "test first" indirectly through:

- **Mutation score** — code that wasn't driven by tests will have weak assertions, lowering the mutation score below threshold.
- **Test commit ratio** — see metric `M-TDD-01` below. PRs without tests fail.
- **Diff coverage** — see metric `M-COV-04`. New/changed lines must hit higher coverage than the baseline.

### 2.4 TDD-Specific Metrics

| ID         | Metric                                  | Target            | Measurement                                                  |
| ---------- | --------------------------------------- | ----------------- | ------------------------------------------------------------ |
| M-TDD-01   | Test-to-code ratio (new code in a PR)   | ≥ 1.0 (LOC tests / LOC production) | git diff analysis in CI                       |
| M-TDD-02   | Diff coverage (new + changed lines)     | ≥ 98% (≥ 100% for critical paths) | Codecov / Coveralls diff report             |
| M-TDD-03   | Mutation score on changed files         | ≥ 80%             | Stryker (TS) per PR                                          |
| M-TDD-04   | Average commit size                     | < 200 LOC         | Git stats (informational, not blocking)                      |
| M-TDD-05   | Time from red to green per cycle        | < 10 minutes      | Self-reported via commit prefix (informational)              |
| M-TDD-06   | PRs without tests                       | 0 (blocking)      | CI step: detect absence of test files in PR diff             |
| M-TDD-07   | Tests added per bug fix                 | ≥ 1               | Bug-labeled PRs must add a regression test                   |

### 2.5 Commit Message Convention for TDD

Optional but recommended commit prefixes to make the cycle visible:

| Prefix     | Meaning                          |
| ---------- | -------------------------------- |
| `red:`     | Failing test added               |
| `green:`   | Test now passes                  |
| `refactor:`| Behavior unchanged, code improved |
| `chore:`   | Tooling, deps, infra             |
| `docs:`    | Documentation only               |

These align with Conventional Commits and feed into the changelog.

---

## 3. Coverage Strategy (98%)

### 3.1 Coverage Definitions

| Type            | Definition                                                    |
| --------------- | ------------------------------------------------------------- |
| Line coverage   | % of executable lines run by at least one test                |
| Branch coverage | % of decision branches (if/else, switch, ternary) exercised   |
| Function coverage | % of functions called by tests                             |
| Statement coverage | % of statements executed                                   |
| Path coverage   | % of independent execution paths (informational)              |
| Mutation score  | % of injected mutants caught by tests                         |
| Diff coverage   | Coverage measured against ONLY the lines changed in a PR      |

### 3.2 Coverage Targets by Layer

#### Backend (Hexagonal)

| Layer                       | Line   | Branch | Mutation | Notes                                |
| --------------------------- | ------ | ------ | -------- | ------------------------------------ |
| Domain (entities, VOs, services) | **100%** | **100%** | **≥ 90%** | Pure code; no excuse for gaps   |
| Application (use cases)     | **100%** | **≥ 98%** | **≥ 80%** | Authorization and orchestration paths |
| Adapters/in (HTTP)          | **≥ 95%** | **≥ 95%** | ≥ 70%   | Validation + error mapping covered  |
| Adapters/out (persistence)  | **≥ 95%** | **≥ 95%** | ≥ 70%   | Mapper round-trip + queries          |
| Shared kernel               | **100%** | **100%** | ≥ 80%   | Used everywhere; must be solid       |
| Composition root / main.ts  | excluded | excluded | n/a    | DI wiring; covered by E2E indirectly |
| Generated code (Prisma client) | excluded | excluded | n/a | Not human-authored                  |
| **Overall backend**         | **≥ 98%**| **≥ 98%**| **≥ 80%**|                                      |

#### Frontend (Reactive)

| Layer                            | Line   | Branch | Mutation | Notes                                  |
| -------------------------------- | ------ | ------ | -------- | -------------------------------------- |
| Pure logic (reducers, selectors, utils) | **100%** | **100%** | **≥ 90%** | Pure functions; mandatory      |
| Streams (RxJS pipelines)         | **100%** | **≥ 98%** | **≥ 80%** | Marble tests                       |
| Hooks (queries, mutations)       | **≥ 95%** | **≥ 95%** | ≥ 70%   | RTL hook tests + MSW                  |
| Components (presentational)      | **≥ 95%** | **≥ 90%** | ≥ 60%   | Render + interaction tests            |
| Components (containers)          | **≥ 95%** | **≥ 90%** | ≥ 60%   | Integration tests with MSW            |
| Design system primitives          | **≥ 98%** | **≥ 95%** | ≥ 70%   | Visual + behavior tests + Storybook   |
| App shell / providers            | excluded* | excluded* | n/a | * Verified by E2E only                |
| **Overall frontend**             | **≥ 98%** | **≥ 98%** | **≥ 75%** |                                     |

### 3.3 Critical Paths (Must Be 100%)

These paths protect security, data integrity, and core business value. **Line + branch coverage = 100%, mutation ≥ 90%.**

| Path                                                         | Owning Module       |
| ------------------------------------------------------------ | ------------------- |
| Login + JWT issuance + refresh rotation + reuse detection    | auth                |
| Account lockout (5 failures / 10 min / 15 min lockout)       | auth                |
| Password hashing and verification                            | auth                |
| RBAC permission checks at use case layer                     | all modules         |
| Content lifecycle state transitions                          | content             |
| Content publish requirements validation                      | content             |
| Public API visibility filter (only published, not deleted)   | public-api          |
| Rich text sanitization (HTML allow-list)                     | content             |
| Media upload type + magic-byte validation                    | media               |
| Audit event write (append-only, never updated)               | audit               |
| Soft delete behavior and hard-delete job                     | content, media      |
| API key creation + hashing + revocation                      | auth                |

### 3.4 Coverage Exclusions (Explicit & Auditable)

Files/lines excluded from coverage must be listed in `coverage.config.ts` and reviewed quarterly.

**Allowed exclusions:**

- Auto-generated code (`*.generated.ts`, Prisma client output, OpenAPI generated types).
- Type-only files (`*.types.ts` with no runtime code).
- Dependency injection containers / composition roots (covered by E2E).
- Logging-only conditional branches (`if (logger.isDebug()) ...`).
- `default:` clauses on exhaustive switches where TypeScript's exhaustiveness check makes them unreachable — must include `assertNever(x)` to make it explicit.

**Never excluded:** business logic, error handling branches, authorization checks, validation.

### 3.5 Coverage Anti-Patterns (Will Fail Review)

| Anti-pattern                                              | Why it fails                                   |
| --------------------------------------------------------- | ---------------------------------------------- |
| Tests that call code without asserting on outcomes       | Inflate coverage without verifying behavior; mutation testing catches |
| `expect(true).toBe(true)` or empty `it()` blocks         | No assertion; fails mutation testing           |
| Catch-all `try/catch` swallowing the only assertion path | Misleading coverage                            |
| Excluding files just to reach 98% threshold               | Quarterly exclusion review will flag           |
| Mocking the system under test                             | Doesn't test real behavior                     |
| Snapshot tests as the sole test                           | Brittle; doesn't drive design                  |

---

## 4. Architecture Metrics — Backend (Hexagonal)

### 4.1 Hexagonal Conformance Metrics

| ID         | Metric                                                       | Target  | Tool                                |
| ---------- | ------------------------------------------------------------ | ------- | ----------------------------------- |
| M-HEX-01   | Domain layer imports from outside (frameworks, ORM, HTTP)    | **0**   | `dependency-cruiser`                |
| M-HEX-02   | Application layer imports from `adapters/*`                  | **0**   | `dependency-cruiser`                |
| M-HEX-03   | Adapters/in importing from adapters/out (or vice versa)      | **0**   | `dependency-cruiser`                |
| M-HEX-04   | Modules importing internals of other modules                 | **0**   | `dependency-cruiser`                |
| M-HEX-05   | Third-party type leakage (Prisma types in application/domain) | **0**   | `dependency-cruiser` + ESLint rule  |
| M-HEX-06   | Outbound port interfaces without at least one in-memory fake | **0**   | Custom script (ts-arch)             |
| M-HEX-07   | Use cases without an integration test                        | **0**   | Test report analyzer                |
| M-HEX-08   | Domain entities exposing setters / mutating public fields    | **0**   | ESLint custom rule                  |

### 4.2 Dependency Direction (Acyclic Layering)

| ID         | Metric                                            | Target  |
| ---------- | ------------------------------------------------- | ------- |
| M-DEP-01   | Circular dependencies (any direction)             | **0**   |
| M-DEP-02   | Maximum module depth (longest dependency chain)   | ≤ 6     |
| M-DEP-03   | Modules with > 8 outgoing dependencies            | 0       |

Enforced by `madge --circular` and `dependency-cruiser`.

### 4.3 Module Cohesion & Coupling

| ID         | Metric                                                | Target           |
| ---------- | ----------------------------------------------------- | ---------------- |
| M-COH-01   | LCOM4 (Lack of Cohesion of Methods) per class         | ≤ 1              |
| M-COH-02   | Afferent coupling (Ca) per module                     | ≤ 10             |
| M-COH-03   | Efferent coupling (Ce) per module                     | ≤ 12             |
| M-COH-04   | Instability (I = Ce / (Ca + Ce))                      | Domain: ≤ 0.2; Adapters: ≥ 0.7 |
| M-COH-05   | Abstractness (A) of domain layer                      | ≥ 0.5            |
| M-COH-06   | Distance from main sequence (\|A + I − 1\|)           | ≤ 0.3            |

Measured by `arkit`, `ts-arch`, or custom analyzer over compiled output.

### 4.4 Public API Surface

| ID         | Metric                                                | Target  |
| ---------- | ----------------------------------------------------- | ------- |
| M-API-01   | Public exports from a module not used externally      | 0       |
| M-API-02   | Use cases with > 5 parameters                         | 0       |
| M-API-03   | DTOs that mix request and response shapes             | 0       |
| M-API-04   | OpenAPI spec drift vs implementation                  | 0 (CI fails on diff) |

---

## 5. Architecture Metrics — Frontend (Reactive)

### 5.1 Reactive Conformance Metrics

| ID         | Metric                                                          | Target  | Tool                |
| ---------- | --------------------------------------------------------------- | ------- | ------------------- |
| M-RX-01    | Components calling `fetch` / `axios` / `XMLHttpRequest` directly | **0**   | ESLint custom rule  |
| M-RX-02    | Components calling `localStorage` / `sessionStorage` directly    | **0**   | ESLint custom rule  |
| M-RX-03    | Direct mutation of state (`state.x = ...`)                       | **0**   | ESLint + immutability check |
| M-RX-04    | Presentational components using `useQuery` / `useMutation`       | **0**   | ESLint custom rule  |
| M-RX-05    | Presentational components reading from Zustand store             | **0**   | ESLint custom rule  |
| M-RX-06    | Features importing from sibling features                          | **0**   | `dependency-cruiser`|
| M-RX-07    | Components > 200 LOC                                              | 0       | ESLint              |
| M-RX-08    | Components with > 6 useState calls                                | 0       | ESLint              |

### 5.2 State Hygiene

| ID         | Metric                                              | Target |
| ---------- | --------------------------------------------------- | ------ |
| M-STATE-01 | Global UI store slices > 200 LOC                    | 0      |
| M-STATE-02 | Query keys not following `[feature, ...]` convention | 0      |
| M-STATE-03 | Stale queries left without invalidation strategy    | 0      |
| M-STATE-04 | RxJS subscriptions without proper teardown          | 0      |

### 5.3 Bundle & Performance

| ID         | Metric                                              | Target            |
| ---------- | --------------------------------------------------- | ----------------- |
| M-BUN-01   | Initial JS bundle (gzipped)                         | ≤ 250 KB          |
| M-BUN-02   | Per-route bundle (gzipped)                          | ≤ 100 KB          |
| M-BUN-03   | CSS bundle (gzipped)                                | ≤ 50 KB           |
| M-BUN-04   | Largest Contentful Paint (LCP) — admin dashboard    | ≤ 2.5 s (P75)     |
| M-BUN-05   | First Input Delay (FID) / Interaction to Next Paint (INP) | ≤ 200 ms (P75) |
| M-BUN-06   | Cumulative Layout Shift (CLS)                       | ≤ 0.1             |
| M-BUN-07   | Lighthouse Performance score                        | ≥ 90              |
| M-BUN-08   | Lighthouse Accessibility score                      | ≥ 95              |

### 5.4 Component Tree Health

| ID         | Metric                                              | Target |
| ---------- | --------------------------------------------------- | ------ |
| M-CMP-01   | Maximum render tree depth                           | ≤ 15   |
| M-CMP-02   | Components without `displayName` (production)       | 0      |
| M-CMP-03   | Inline anonymous functions passed as props (perf risk) | informational only |

---

## 6. Code Quality Metrics

### 6.1 Complexity

| ID         | Metric                                                       | Target          |
| ---------- | ------------------------------------------------------------ | --------------- |
| M-CPX-01   | Cyclomatic complexity per function                           | ≤ 10            |
| M-CPX-02   | Cognitive complexity per function                            | ≤ 15            |
| M-CPX-03   | Maximum nesting depth                                        | ≤ 4             |
| M-CPX-04   | Function length (LOC, excluding comments/blank)              | ≤ 50            |
| M-CPX-05   | Function parameter count                                     | ≤ 4             |
| M-CPX-06   | Class length                                                 | ≤ 300 LOC       |
| M-CPX-07   | File length                                                  | ≤ 400 LOC       |

### 6.2 Duplication

| ID         | Metric                                              | Target  |
| ---------- | --------------------------------------------------- | ------- |
| M-DUP-01   | Code duplication ratio                              | ≤ 3%    |
| M-DUP-02   | Duplicate block size threshold (tokens)             | ≥ 50 tokens triggers detection |
| M-DUP-03   | Maximum duplicate block instances                   | ≤ 2 per duplicated block       |

Measured by `jscpd`.

### 6.3 Technical Debt

| ID         | Metric                                              | Target            |
| ---------- | --------------------------------------------------- | ----------------- |
| M-DEBT-01  | SonarQube technical debt ratio                      | ≤ 5%              |
| M-DEBT-02  | TODO/FIXME comments without linked issue            | 0                 |
| M-DEBT-03  | Deprecated API usage                                | 0                 |
| M-DEBT-04  | `any` type usage in TypeScript (production code)    | 0 (use `unknown` or proper types) |
| M-DEBT-05  | `@ts-ignore` / `@ts-expect-error` without justification comment | 0       |
| M-DEBT-06  | ESLint `disable` without justification comment      | 0                 |

### 6.4 Type Safety (TypeScript)

| ID         | Metric                                              | Target    |
| ---------- | --------------------------------------------------- | --------- |
| M-TS-01    | `strict: true` in tsconfig                          | Required  |
| M-TS-02    | `noUncheckedIndexedAccess: true`                    | Required  |
| M-TS-03    | `exactOptionalPropertyTypes: true`                  | Required  |
| M-TS-04    | `noImplicitOverride: true`                          | Required  |
| M-TS-05    | TypeScript compile errors                           | 0         |
| M-TS-06    | TypeScript warnings                                 | 0         |

### 6.5 Linting

| ID         | Metric                                              | Target  |
| ---------- | --------------------------------------------------- | ------- |
| M-LINT-01  | ESLint errors                                       | 0       |
| M-LINT-02  | ESLint warnings (production code)                   | 0       |
| M-LINT-03  | Prettier formatting violations                      | 0       |

---

## 7. Test Quality Metrics

### 7.1 Test Effectiveness

| ID         | Metric                                              | Target           |
| ---------- | --------------------------------------------------- | ---------------- |
| M-TEST-01  | Unit test execution time                            | ≤ 60 s (total)   |
| M-TEST-02  | Integration test execution time                     | ≤ 5 min (total)  |
| M-TEST-03  | E2E test execution time                             | ≤ 15 min (total) |
| M-TEST-04  | Flaky test rate (tests requiring retry)             | ≤ 0.5%           |
| M-TEST-05  | Tests skipped (`xit`, `it.skip`, `describe.skip`)   | 0                |
| M-TEST-06  | Mutation score — overall                            | ≥ 80%            |
| M-TEST-07  | Mutation score — critical paths                     | ≥ 90%            |
| M-TEST-08  | Tests asserting only on existence (truthy/falsy)    | informational    |

### 7.2 Test Code Quality

| ID         | Metric                                              | Target  |
| ---------- | --------------------------------------------------- | ------- |
| M-TQ-01    | Test files following AAA pattern (Arrange/Act/Assert) | ≥ 95% (lint rule) |
| M-TQ-02    | Test names starting with "should..." or descriptive sentence | informational |
| M-TQ-03    | Tests with multiple unrelated assertions            | 0       |
| M-TQ-04    | Tests sharing mutable state between cases           | 0       |
| M-TQ-05    | Tests longer than 30 LOC                            | informational |
| M-TQ-06    | Tests using real network / real DB outside integration scope | 0 |

### 7.3 Test Distribution (Test Pyramid)

| Level       | Target Ratio | Tools                              |
| ----------- | ------------ | ---------------------------------- |
| Unit        | ≥ 70%        | Vitest                             |
| Integration | 20–25%       | Vitest + Testcontainers / MSW      |
| E2E         | ≤ 10%        | Playwright                         |

| ID         | Metric                                  | Target |
| ---------- | --------------------------------------- | ------ |
| M-PYR-01   | Unit test count / total test count       | ≥ 70%  |
| M-PYR-02   | E2E test count / total test count        | ≤ 10%  |
| M-PYR-03   | Tests at the wrong layer (e.g., E2E for what should be unit) | informational |

---

## 8. Security & Dependency Metrics

### 8.1 Vulnerability Posture

| ID         | Metric                                              | Target              |
| ---------- | --------------------------------------------------- | ------------------- |
| M-SEC-01   | Critical CVEs in production dependencies            | **0**               |
| M-SEC-02   | High-severity CVEs in production dependencies       | **0**               |
| M-SEC-03   | Medium-severity CVEs                                | ≤ 5 (with action plan) |
| M-SEC-04   | Low-severity CVEs                                   | informational       |
| M-SEC-05   | CVEs in dev dependencies (critical/high)            | 0                   |
| M-SEC-06   | Time to patch critical CVE                          | ≤ 24 hours          |
| M-SEC-07   | Time to patch high CVE                              | ≤ 7 days            |

Scanned by Dependabot, Snyk, or Trivy on every PR + nightly.

### 8.2 Static Application Security Testing (SAST)

| ID         | Metric                                              | Target              |
| ---------- | --------------------------------------------------- | ------------------- |
| M-SAST-01  | Critical / high SAST findings                       | 0                   |
| M-SAST-02  | Hardcoded secrets detected (gitleaks)               | 0                   |
| M-SAST-03  | OWASP Top 10 categories covered by SAST rules       | All 10              |
| M-SAST-04  | New SAST findings introduced by PR                  | 0                   |

Tools: Semgrep, CodeQL, SonarQube security rules, gitleaks.

### 8.3 License Compliance

| ID         | Metric                                              | Target  |
| ---------- | --------------------------------------------------- | ------- |
| M-LIC-01   | GPL / AGPL / proprietary licenses in production deps | 0      |
| M-LIC-02   | Unrecognized / unknown licenses                     | 0       |
| M-LIC-03   | Allowed licenses                                    | MIT, Apache-2.0, BSD-2/3, ISC, MPL-2.0 |

Scanned by `license-checker` or `fossa`.

### 8.4 Container & Infrastructure Security

| ID         | Metric                                              | Target  |
| ---------- | --------------------------------------------------- | ------- |
| M-INF-01   | Container base image CVEs (critical/high)           | 0       |
| M-INF-02   | Container runs as non-root                          | Required |
| M-INF-03   | Container image size                                | ≤ 300 MB |
| M-INF-04   | Terraform plan with policy violations (tfsec / Checkov) | 0    |
| M-INF-05   | Secrets in IaC / config files                       | 0       |

---

## 9. Performance & Reliability Metrics

### 9.1 API Performance (Synthetic + Production)

| ID         | Metric                                              | Target              |
| ---------- | --------------------------------------------------- | ------------------- |
| M-PERF-01  | Public API P95 latency (cached)                     | ≤ 200 ms            |
| M-PERF-02  | Public API P95 latency (uncached)                   | ≤ 600 ms            |
| M-PERF-03  | Admin API mutation P95 latency                      | ≤ 800 ms            |
| M-PERF-04  | Database query P95 latency                          | ≤ 100 ms            |
| M-PERF-05  | Slow queries (> 1 s) per 1M requests                | < 10                |
| M-PERF-06  | API error rate (5xx) per 1M requests                | < 100               |
| M-PERF-07  | Memory usage per replica                            | ≤ 512 MB            |
| M-PERF-08  | CPU usage per replica (steady state)                | ≤ 50%               |

### 9.2 Reliability SLO

| ID         | Metric                                              | Target              |
| ---------- | --------------------------------------------------- | ------------------- |
| M-REL-01   | Production uptime (rolling 30 days)                 | ≥ 99.5%             |
| M-REL-02   | Successful deploy rate                              | ≥ 95%               |
| M-REL-03   | Mean time to recovery (MTTR) for production incidents | ≤ 4 hours          |
| M-REL-04   | Change failure rate                                 | ≤ 15%               |
| M-REL-05   | Backup success rate                                 | 100%                |
| M-REL-06   | Successful restore drill (quarterly)                | Required            |

### 9.3 Load Testing

| ID         | Metric                                              | Target              |
| ---------- | --------------------------------------------------- | ------------------- |
| M-LOAD-01  | Sustained RPS on public API without degradation    | ≥ 200 RPS           |
| M-LOAD-02  | P99 latency under sustained load                    | ≤ 1 s               |
| M-LOAD-03  | Error rate under sustained load                     | ≤ 0.1%              |
| M-LOAD-04  | Load tests run                                      | Weekly (staging)    |

Tools: k6, Artillery.

---

## 10. Process & Delivery Metrics

### 10.1 PR Hygiene

| ID         | Metric                                              | Target              |
| ---------- | --------------------------------------------------- | ------------------- |
| M-PR-01    | PR size (LOC changed)                               | ≤ 400 (median)      |
| M-PR-02    | PR review turnaround time                           | ≤ 1 business day    |
| M-PR-03    | PRs merged without review                           | 0                   |
| M-PR-04    | PRs merged with failing CI                          | 0                   |
| M-PR-05    | Required approvers                                  | ≥ 1                 |
| M-PR-06    | PRs with conventional commit titles                 | 100%                |

### 10.2 DORA Metrics

| ID         | Metric                                              | Target (Elite/High) |
| ---------- | --------------------------------------------------- | ------------------- |
| M-DORA-01  | Deployment frequency                                | ≥ Daily             |
| M-DORA-02  | Lead time for changes                               | ≤ 1 day             |
| M-DORA-03  | Change failure rate                                 | ≤ 15%               |
| M-DORA-04  | Mean time to restore                                | ≤ 1 hour            |

### 10.3 Documentation

| ID         | Metric                                              | Target              |
| ---------- | --------------------------------------------------- | ------------------- |
| M-DOC-01   | Public API endpoints documented in OpenAPI          | 100%                |
| M-DOC-02   | Architecture Decision Records (ADRs) for significant choices | ≥ 1 per quarter |
| M-DOC-03   | README + CONTRIBUTING + RUNBOOK present             | Required            |
| M-DOC-04   | Onboarding doc out of date (> 90 days)              | 0                   |

---

## 11. Quality Gates — Definitions & Thresholds

A **Quality Gate** is a named, automated check at a specific point in the development workflow. Gates run in order; a failure stops the workflow.

### 11.1 Gate Catalog

| Gate ID | Name                          | When                       | Blocks                      |
| ------- | ----------------------------- | -------------------------- | --------------------------- |
| G-01    | Pre-commit gate               | Local, on `git commit`     | Commit                      |
| G-02    | Pre-push gate                 | Local, on `git push`       | Push                        |
| G-03    | PR-open gate                  | CI on PR open / sync       | PR mergeable status         |
| G-04    | PR-merge gate                 | CI before merge to main    | Merge to main               |
| G-05    | Main-branch gate              | CI on push to main         | Deployment artifact build   |
| G-06    | Pre-deploy gate (staging)     | Deployment pipeline        | Promotion to staging        |
| G-07    | Pre-deploy gate (production)  | Deployment pipeline        | Promotion to production     |
| G-08    | Post-deploy gate              | After deploy               | Rollback trigger if fails   |
| G-09    | Nightly gate                  | Scheduled                  | Alerts; not deploy-blocking |
| G-10    | Release gate                  | Tagged release             | Tag creation                |

### 11.2 G-01 — Pre-commit Gate (Husky + lint-staged)

Runs on `git commit`. Fast checks only — must complete in < 10 s.

| Check                                | Threshold |
| ------------------------------------ | --------- |
| Prettier formatting on staged files  | Pass      |
| ESLint on staged files               | 0 errors  |
| Type check on staged files (tsc -p, incremental) | 0 errors |
| Detect secrets (gitleaks staged)     | 0 findings|
| Conventional commit message format   | Match     |

### 11.3 G-02 — Pre-push Gate

Runs on `git push`. Catches what should be caught before the CI starts.

| Check                                | Threshold |
| ------------------------------------ | --------- |
| Full TypeScript build                | Pass      |
| Unit tests (changed files + dependents) | All pass |
| Commit message lint (all new commits) | Pass     |

### 11.4 G-03 — PR-open Gate (Required for PR Status)

Runs on every push to a PR branch. This is the workhorse gate.

| Check                                                   | Threshold              | Metric refs       |
| ------------------------------------------------------- | ---------------------- | ----------------- |
| Build (TypeScript)                                      | 0 errors               | M-TS-05           |
| Lint (ESLint, Prettier)                                 | 0 errors, 0 warnings   | M-LINT-01..03     |
| Type strictness checks                                  | All flags enabled      | M-TS-01..04       |
| Architecture conformance (dependency-cruiser)           | 0 violations           | M-HEX-01..04, M-RX-01..06 |
| Unit tests                                              | 100% pass              | M-TEST-01         |
| Integration tests                                       | 100% pass              | M-TEST-02         |
| Coverage — overall line                                 | ≥ 98%                  | M-COV (this doc)  |
| Coverage — overall branch                               | ≥ 98%                  |                   |
| Coverage — diff (new/changed lines)                     | ≥ 98%                  | M-TDD-02          |
| Coverage — critical paths                               | 100%                   | Section 3.3       |
| Mutation testing on changed files (Stryker)             | ≥ 80%                  | M-TDD-03          |
| Complexity                                              | ≤ thresholds Section 6.1 | M-CPX-01..07    |
| Duplication                                             | ≤ 3%                   | M-DUP-01          |
| `any` type usage                                        | 0                      | M-DEBT-04         |
| `@ts-ignore` / `eslint-disable` without justification   | 0                      | M-DEBT-05, 06     |
| Skipped tests                                           | 0                      | M-TEST-05         |
| Test-to-code ratio                                      | ≥ 1.0                  | M-TDD-01          |
| Bundle size (FE)                                        | within budgets         | M-BUN-01..03      |
| Dependency scan (Snyk / Dependabot)                     | 0 critical/high        | M-SEC-01..02      |
| SAST scan (Semgrep / CodeQL)                            | 0 critical/high        | M-SAST-01         |
| Secret scan (gitleaks)                                  | 0                      | M-SAST-02         |
| License scan                                            | 0 disallowed           | M-LIC-01..03      |
| OpenAPI spec validity & in sync with code               | Pass                   | M-API-04          |
| Conventional commit titles                              | 100%                   | M-PR-06           |
| At least 1 approving review                             | Required               | M-PR-05           |

**Gate fails if ANY check fails.** No exceptions without a documented waiver (Section 15).

### 11.5 G-04 — PR-merge Gate

Final check before merge button enables. Runs E2E tests (which are too slow for every push).

| Check                                | Threshold |
| ------------------------------------ | --------- |
| All G-03 checks still pass            | Yes       |
| E2E tests (Playwright, smoke + critical) | 100% pass |
| Branch up-to-date with main           | Yes       |
| No new commits since last review      | Yes (re-review required if changed) |

### 11.6 G-05 — Main-branch Gate

Runs on every merge to `main`. Builds the deployment artifact.

| Check                                | Threshold |
| ------------------------------------ | --------- |
| Full test suite (unit + integration + E2E) | 100% pass |
| Container image build                | Success   |
| Container image vulnerability scan (Trivy) | 0 critical/high | 
| SBOM generated (Syft)                | Required  |
| Container signed (cosign)            | Required  |
| Artifact uploaded to registry        | Success   |

### 11.7 G-06 — Staging Deploy Gate

| Check                                | Threshold |
| ------------------------------------ | --------- |
| G-05 artifact signed                 | Required  |
| Schema migration plan reviewed       | Required  |
| Deploy to staging                    | Success   |
| Smoke test suite on staging          | 100% pass |
| Synthetic monitoring green           | Required  |

### 11.8 G-07 — Production Deploy Gate

| Check                                | Threshold              |
| ------------------------------------ | ---------------------- |
| G-06 passed                          | Required               |
| Staging soak time                    | ≥ 30 minutes           |
| Load test ran in staging this week   | Required (M-LOAD-04)   |
| Manual approval                      | Required (Tech Lead)   |
| Off-hours OR change window approved  | Required               |
| Rollback plan documented             | Required               |
| Database migration is forward+backward compatible | Required  |

### 11.9 G-08 — Post-deploy Gate (auto-rollback trigger)

Runs for 15 minutes after deploy.

| Check                                              | Threshold (vs baseline)  |
| -------------------------------------------------- | ------------------------ |
| Error rate (5xx)                                   | ≤ 2× baseline             |
| P95 latency                                        | ≤ 1.5× baseline           |
| Health check failures                              | 0                         |
| Critical alerts firing                             | 0                         |

Failure → automatic rollback to previous artifact.

### 11.10 G-09 — Nightly Gate

| Check                                | Threshold |
| ------------------------------------ | --------- |
| Full test suite                      | 100% pass |
| Mutation testing (full suite)        | ≥ 80% overall, ≥ 90% critical |
| Dependency scan (latest CVEs)        | 0 critical/high (alerts on new) |
| Performance regression tests (k6)    | within budgets |
| Backup verification                  | Restore drill weekly |
| Cost budget check (cloud spend)      | within plan |

### 11.11 G-10 — Release Gate (tagged version)

| Check                                | Threshold |
| ------------------------------------ | --------- |
| All G-09 checks green for 7 days     | Required  |
| Changelog updated                    | Required  |
| Version bumped (SemVer)              | Required  |
| Release notes drafted                | Required  |
| Docs site published                  | Required  |

---

## 12. Gate Enforcement in CI/CD Pipeline

### 12.1 Pipeline Topology (GitHub Actions example)

```
┌─────────────────────────────────────────────────────────────┐
│  Developer pushes commit                                     │
└──────────────────────────────────┬──────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  G-03 PR-open Gate (parallel jobs)                           │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ lint +   │  │ unit +   │  │ arch +   │  │ security │    │
│  │ type     │  │ coverage │  │ openapi  │  │ scans    │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │              │             │           │
│       └─────────────┴──────┬───────┴─────────────┘           │
│                            │                                  │
│                            ▼                                  │
│                  ┌──────────────────┐                        │
│                  │ integration tests│                        │
│                  │ (with DB/Redis)  │                        │
│                  └────────┬─────────┘                        │
│                           │                                   │
│                           ▼                                   │
│                  ┌──────────────────┐                        │
│                  │ mutation testing │                        │
│                  │ (changed files)  │                        │
│                  └────────┬─────────┘                        │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼ (PR approved, ready to merge)
┌─────────────────────────────────────────────────────────────┐
│  G-04 PR-merge Gate                                          │
│  E2E tests (Playwright)                                      │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼ (merge to main)
┌─────────────────────────────────────────────────────────────┐
│  G-05 Main-branch Gate                                       │
│  Full test suite → Build image → Trivy → SBOM → Sign         │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  G-06 Staging Deploy Gate                                    │
│  Migrate → Deploy → Smoke test                               │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼ (manual approval)
┌─────────────────────────────────────────────────────────────┐
│  G-07 Production Deploy Gate                                 │
│  Deploy → G-08 Post-deploy watch (15 min)                    │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Required Status Checks (GitHub Branch Protection)

`main` branch protection rules:

- Require pull request before merging.
- Require approvals: 1.
- Dismiss stale approvals on new commits.
- Require status checks to pass before merging (all G-03 + G-04 checks).
- Require branches to be up to date before merging.
- Require linear history.
- Require signed commits.
- Restrict who can push to `main`: none (only via PR).
- No force push.
- No deletion.

### 12.3 Sample GitHub Actions Workflow Skeleton

```yaml
name: PR Gate

on:
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck

  arch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm depcruise
      - run: pnpm ts-arch
      - run: pnpm openapi:diff

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit --coverage
      - name: Coverage gate (98%)
        run: |
          pnpm coverage:check \
            --lines 98 --branches 98 --functions 98 --statements 98
      - name: Diff coverage gate
        uses: 5monkeys/cobertura-action@v14
        with:
          minimum_coverage: 98
          show_missing: true

  test-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: --health-cmd pg_isready
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma migrate deploy
      - run: pnpm test:integration

  mutation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - name: Stryker mutation (changed files)
        run: pnpm stryker run --since main
      - name: Mutation gate (80%)
        run: pnpm stryker:check --threshold 80

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        with:
          args: --severity-threshold=high --fail-on=upgradable
      - uses: gitleaks/gitleaks-action@v2
      - uses: github/codeql-action/analyze@v3

  e2e:
    needs: [lint, arch, test-unit, test-integration, mutation, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
```

---

## 13. Tooling Matrix

| Concern                       | Backend Tool                    | Frontend Tool                       |
| ----------------------------- | ------------------------------- | ----------------------------------- |
| Test runner                   | Vitest                          | Vitest                              |
| Coverage                      | Vitest + c8 / Istanbul          | Vitest + c8 / Istanbul              |
| Mutation testing              | Stryker (TS)                    | Stryker (TS)                        |
| Integration test infra        | Testcontainers (Postgres, Redis)| MSW (mock HTTP)                     |
| E2E                           | (shared) Playwright             | Playwright                          |
| Marble testing (streams)      | n/a                             | rxjs/testing TestScheduler          |
| Lint                          | ESLint (typescript-eslint)      | ESLint (typescript-eslint, react)   |
| Format                        | Prettier                        | Prettier                            |
| Type check                    | tsc (strict)                    | tsc (strict)                        |
| Dependency rules              | dependency-cruiser              | dependency-cruiser + eslint-plugin-boundaries |
| Architecture tests            | ts-arch                         | ts-arch                             |
| Complexity                    | eslint-plugin-sonarjs, eslint-plugin-complexity | same                |
| Duplication                   | jscpd                           | jscpd                               |
| Static analysis (deep)        | SonarQube + Semgrep + CodeQL    | SonarQube + Semgrep + CodeQL        |
| Dependency vuln scan          | Snyk / Dependabot               | Snyk / Dependabot                   |
| Secret scan                   | gitleaks                        | gitleaks                            |
| Container scan                | Trivy                           | n/a                                 |
| License scan                  | license-checker                 | license-checker                     |
| API contract                  | OpenAPI generator + spectral lint | openapi-typescript                |
| Performance (load)            | k6                              | Lighthouse CI, web-vitals           |
| Observability                 | OpenTelemetry + Pino + Sentry   | OpenTelemetry browser SDK + Sentry  |
| Bundle analysis               | n/a                             | rollup-plugin-visualizer            |
| Storybook                     | n/a                             | Storybook + Chromatic               |
| Pre-commit                    | Husky + lint-staged             | Husky + lint-staged                 |
| Commit lint                   | commitlint (conventional)       | commitlint                          |

---

## 14. Reporting & Dashboards

### 14.1 Per-PR Report (Comment on PR)

Auto-generated on each PR (e.g., via GitHub Actions + bot comment):

```
═══════════════════════════════════════════════════════════
  Quality Gate Report — PR #1234
═══════════════════════════════════════════════════════════

  ✓ Lint                          0 errors, 0 warnings
  ✓ Types                         Pass (strict)
  ✓ Architecture                  0 violations
  ✓ Unit tests                    312 passed in 23s
  ✓ Integration tests             47 passed in 1m 12s
  ✓ E2E tests                     18 passed in 4m 30s
  ✓ Coverage (overall)            98.4% lines  /  98.1% branches
  ✓ Coverage (diff)               99.2% on 87 changed lines
  ✓ Critical paths                100%
  ✓ Mutation (changed)            83.5% (47 mutants killed / 56)
  ✓ Complexity                    Max 8 (limit 10)
  ✓ Duplication                   1.2% (limit 3%)
  ✓ Bundle size (admin SPA)       228 KB gzipped (limit 250)
  ✓ Dependencies                  0 critical, 0 high
  ✓ SAST                          0 findings
  ✓ Secrets                       Clean
  ✓ License                       OK

  Test-to-code ratio:             1.4   ✓
  Skipped tests:                  0     ✓
  TODO/FIXME (new):               0     ✓

  ═════════════════════════════════════════════════════════
  RESULT: ✓ PASS — All gates green. Ready to merge.
  ═════════════════════════════════════════════════════════
```

### 14.2 Team Dashboard (Daily)

Hosted dashboard (e.g., Grafana) showing:

- Current coverage trend (last 30 days)
- Mutation score trend
- Test count by layer (pyramid visual)
- Flaky tests leaderboard
- Open security findings
- DORA metrics (deploy frequency, lead time, MTTR, CFR)
- Production SLO (error rate, latency P95, uptime)
- Tech debt ratio over time

### 14.3 Weekly Quality Review (Tech Lead Standing Agenda)

Items reviewed every Monday:

1. New CVEs and patch status.
2. Coverage drift (any module trending below 98%?).
3. Flaky test report; assign owners.
4. Production incidents and post-mortems.
5. Waivers issued in the past week (Section 15).
6. SLO burn rate.

---

## 15. Exceptions & Waivers

### 15.1 When Waivers Are Allowed

A quality gate may be waived only when **all** of the following hold:

1. Blocking the work would cause greater harm than the gate prevents (e.g., production hotfix for a critical incident).
2. The gate violation is fully understood and documented.
3. A remediation plan exists with a deadline.
4. The waiver is approved by the Tech Lead **and** logged in the project tracker.

### 15.2 Waiver Process

1. Author opens a waiver request in `docs/waivers/YYYY-MM-DD-short-title.md` containing:
   - Gate(s) being waived.
   - Reason.
   - Risk assessment.
   - Remediation plan with deadline.
   - Approver name + date.
2. Tech Lead reviews and either approves (commits) or rejects.
3. If approved, the CI label `waiver-approved` allows the merge.
4. Waiver appears in the weekly review until remediated.

### 15.3 What Cannot Be Waived

- Critical / high CVEs in production deps (these must be fixed or the dep removed).
- Secrets in code.
- Critical SAST findings.
- Coverage on critical paths (Section 3.3) below 100%.
- Mutation score on critical paths below 90%.
- Failing tests (skipping is not a waiver — it's a regression).
- Bypassing required reviews on `main`.

### 15.4 Waiver Auto-Expiry

Every waiver has a hard expiry date (max 30 days). On expiry, the gate re-engages. Extensions require a new waiver.

---

## 16. Appendices

### 16.1 Appendix A — Coverage Configuration (Vitest)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.types.ts',
        'src/**/*.generated.ts',
        'src/**/index.ts',                // re-exports only
        'src/composition/**',             // DI wiring
        'src/main.ts',
        'src/**/__tests__/**',
        'prisma/**',
      ],
      thresholds: {
        lines: 98,
        functions: 98,
        branches: 98,
        statements: 98,
        // Per-file thresholds for critical paths
        'src/modules/auth/**': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        'src/modules/content/domain/**': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        'src/modules/public-api/**': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  },
});
```

### 16.2 Appendix B — Stryker Configuration

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "packageManager": "pnpm",
  "testRunner": "vitest",
  "reporters": ["html", "clear-text", "progress", "dashboard"],
  "coverageAnalysis": "perTest",
  "mutate": [
    "src/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/**/*.test.ts",
    "!src/**/*.types.ts",
    "!src/**/*.generated.ts",
    "!src/composition/**",
    "!src/main.ts"
  ],
  "thresholds": {
    "high": 90,
    "low": 80,
    "break": 80
  },
  "incremental": true
}
```

### 16.3 Appendix C — dependency-cruiser Rule Sample

```javascript
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    {
      name: 'no-framework-in-domain',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: {
        path: [
          'node_modules/(@nestjs|express|fastify|prisma)',
          '^src/modules/[^/]+/(adapters|application)',
        ],
      },
    },
    {
      name: 'no-adapter-in-application',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application' },
      to: { path: '^src/modules/[^/]+/adapters' },
    },
    {
      name: 'no-cross-module-internals',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)' },
      to: {
        path: '^src/modules/(?!\\1)[^/]+/(domain|application/use-cases|adapters)',
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'] },
  },
};
```

### 16.4 Appendix D — Critical Path Test Inventory

For each critical path in Section 3.3, the following test files MUST exist and be at 100% coverage:

| Critical Path                              | Required Tests                                              |
| ------------------------------------------ | ----------------------------------------------------------- |
| Login + JWT issuance                       | `auth/application/use-cases/login.use-case.spec.ts`<br>`auth/adapters/in/http/auth.controller.integration.spec.ts` |
| Refresh rotation + reuse detection         | `auth/application/use-cases/refresh-token.use-case.spec.ts`<br>+ e2e flow |
| Account lockout                            | `auth/application/use-cases/login.use-case.spec.ts` (lockout cases)<br>`auth/adapters/in/rate-limit.guard.spec.ts` |
| Password hash + verify                     | `auth/adapters/out/crypto/argon2-password-hasher.spec.ts`   |
| RBAC permission checks                     | per-module `application/policies/*.policy.spec.ts`          |
| Content lifecycle transitions              | `content/domain/services/content-lifecycle.service.spec.ts` (all transitions, all invalid combos) |
| Publish requirements validation             | `content/domain/services/publish-requirements-checker.spec.ts` |
| Public API visibility filter               | `public-api/application/use-cases/list-published-content.spec.ts`<br>`public-api/adapters/in/http/articles.controller.integration.spec.ts` |
| Rich text sanitization                     | `content/application/sanitizer.service.spec.ts` (XSS vectors, allow-list) |
| Media upload validation                     | `media/application/use-cases/finalize-media.use-case.spec.ts` (mime/extension/magic-byte mismatches) |
| Audit append-only                          | `audit/adapters/out/persistence/prisma-audit.repository.spec.ts` (no update/delete paths) |
| Soft delete + hard delete job              | `content/application/use-cases/delete-content.use-case.spec.ts`<br>`content/application/jobs/hard-delete-job.spec.ts` |
| API key create + hash + revoke              | `auth/application/use-cases/create-api-key.use-case.spec.ts`<br>`auth/application/use-cases/revoke-api-key.use-case.spec.ts` |

### 16.5 Appendix E — Sample TDD Workflow

A concrete example of building "Publish content" use case via TDD:

```
Step 1 (red):    Write content.entity.spec.ts: 'publish() should transition draft → published'
                 Run test → fails (publish method doesn't exist).
                 Commit: "red: content.publish() should transition draft to published"

Step 2 (green):  Add publish() method to Content entity, minimal impl.
                 Run test → passes.
                 Commit: "green: implement Content.publish()"

Step 3 (red):    Add test: 'publish() should reject when missing SEO description'
                 Run → fails.
                 Commit: "red: publish() requires SEO description"

Step 4 (green):  Add validation in publish().
                 Run → passes.
                 Commit: "green: validate SEO description in publish()"

Step 5 (refactor): Extract PublishRequirementsChecker domain service.
                   Run → still passes.
                   Commit: "refactor: extract PublishRequirementsChecker"

Step 6 (red):    Write publish-content.use-case.spec.ts: 'should require editor role'
                 Run → fails.
                 Commit: "red: PublishContent should require editor role"

Step 7 (green):  Add authorization check in use case.
                 Run → passes.
                 Commit: "green: PublishContent authorizes editor role"

... continues until full behavior covered.
```

### 16.6 Appendix F — Glossary

| Term                  | Definition                                                       |
| --------------------- | ---------------------------------------------------------------- |
| Coverage              | Proportion of code exercised by tests (line, branch, function, statement) |
| Mutation testing      | Test quality measure: inject small code changes ("mutants") and verify tests catch them |
| Diff coverage         | Coverage measured only on lines changed in a PR                  |
| Quality gate          | An automated check that blocks progress when criteria not met    |
| Critical path         | Code path where bugs cause severe harm (security, data, compliance) |
| Cyclomatic complexity | Number of linearly independent paths through a function           |
| Cognitive complexity  | Human-readable measure of code complexity (SonarSource definition) |
| LCOM4                 | Lack of Cohesion of Methods (lower = more cohesive)              |
| Afferent coupling     | Number of modules depending on this module                       |
| Efferent coupling     | Number of modules this module depends on                         |
| Instability           | Ce / (Ca + Ce); how likely the module is to change               |
| Abstractness          | Ratio of abstract to concrete elements in a module               |
| TDD                   | Test-Driven Development: red → green → refactor                  |
| SBOM                  | Software Bill of Materials                                       |
| DORA metrics          | Four key DevOps metrics (deploy freq, lead time, MTTR, CFR)      |
| SLO                   | Service Level Objective                                          |
| SAST                  | Static Application Security Testing                              |

### 16.7 Appendix G — Document Change Log

| Version | Date       | Author | Change                                  |
| ------- | ---------- | ------ | --------------------------------------- |
| 1.0     | 2026-05-11 | —      | Initial metrics & quality gates spec    |

---

**End of Document**
