# Quality gate status

What is actually enforced today, measured against 05-METRICS §11. Update this table whenever a gate
changes. `pnpm gate` runs the local steps, and `pnpm gate:self-test` proves that the rules marked
**Self-tested** fail on a planted violation.

## G-03 PR gate

| Check                                | Metric                 | Status                                             |
| ------------------------------------ | ---------------------- | -------------------------------------------------- |
| TypeScript compile and strict flags  | M-TS-01..05            | Enforced. Self-tested                              |
| ESLint and Prettier, 0 warnings      | M-LINT-01..03          | Enforced                                           |
| Complexity and size limits           | M-CPX-01..07           | Enforced. Self-tested for complexity               |
| `any` and undocumented suppressions  | M-DEBT-04..06          | Enforced. Self-tested for `any`                    |
| Unlinked TODO and FIXME              | M-DEBT-02              | Enforced. Self-tested                              |
| Skipped and focused tests            | M-TEST-05              | Enforced. Self-tested for skipped tests            |
| Hexagonal rules                      | M-HEX-01..05           | Enforced. Self-tested                              |
| Fake for every outbound port         | M-HEX-06               | Enforced. Self-tested                              |
| Use case without a spec              | M-HEX-07               | Enforced as "a spec imports it". Self-tested       |
| Mutable domain fields and setters    | M-HEX-08               | Enforced for fields and setters. Self-tested       |
| Circular dependencies                | M-DEP-01               | Enforced. Self-tested                              |
| Reactive rules                       | M-RX-01,02,04,05,06,07 | Enforced. Self-tested for 01, 04 and 06            |
| Coverage, overall and per layer      | §3.2, §3.3             | Enforced across unit and Docker tests. Self-tested |
| Mutation score                       | M-TDD-03, M-TEST-06    | Enforced on the in-process suite. Self-tested      |
| Mutation on domain and critical code | M-TEST-07, §3.3        | Enforced at 90% by group. Self-tested              |
| Duplication                          | M-DUP-01               | Enforced. Self-tested                              |
| Bundle budgets                       | M-BUN-01..03           | Enforced                                           |
| License allow-list                   | M-LIC-01..03           | Enforced for production dependencies               |
| Dependency CVEs, critical and high   | M-SEC-01,02,05         | Enforced                                           |
| Commit and PR title format           | M-PR-06                | Enforced                                           |
| Test-to-code ratio                   | M-TDD-01,06            | Skipped until `origin/main` exists                 |
| Secret scan                          | M-SAST-02              | Enforced locally, in pre-commit and in CI          |
| SAST (CodeQL)                        | M-SAST-01              | CI workflow written, never run                     |

## Not enforced yet

| Check                              | Metric             | Arrives in  |
| ---------------------------------- | ------------------ | ----------- |
| Diff coverage on changed lines     | M-TDD-02           | With git    |
| Mutation on changed files only     | M-TDD-03           | With git    |
| OpenAPI validity and drift         | M-API-04           | Phase 5     |
| Component limits and subscriptions | M-RX-08, M-STATE-* | Phase 6     |
| React lint rules, i18n literals    | NFR-I18N-03        | Phase 6     |
| E2E, Lighthouse, axe               | G-04, M-BUN-04..08 | Phases 6, 7 |
| Container scan, SBOM, signing      | G-05, M-INF-*      | Phase 8     |

## Not measured by design for now

- Cohesion and coupling (M-COH-\*), dependency depth (M-DEP-02) and module fan-out (M-DEP-03). No
  module exists yet, so revisit these at the Phase 3 architecture review.
- SonarQube debt ratio (M-DEBT-01) and test pyramid ratios (M-PYR-\*). The first needs a server, and
  the second means nothing until integration tests exist.
- Needs people or production: review turnaround, DORA, SLOs, load tests, G-06 to G-10.

## Known gaps in what passes

- Deployed environments must connect as `cms_app`, which has no UPDATE, DELETE or TRUNCATE on
  `audit_events`. The migration creates that role without a login. Local development still connects
  as the owner, where only the trigger protects the table. Phase 8 adds the login and grants for
  later tables, because each migration that adds a table must grant it to the role.
- The CSV export has no test for write backpressure (the `drain` path).
- Mutation testing skips driven adapters (`adapters/out`), because they need containers. They are
  covered by the Docker tests at 100% line coverage for auth, but M-TEST targets of 70% for them are
  not measured.
- The critical path bar in §3.3 asks for 90% on the HTTP adapters of auth too. Only domain and
  application are held to it, and adapters only count toward the overall 80%.
- M-HEX-07 asks for an integration test per use case. The check proves that a spec imports each one.
- SMTP is tested against a real server with STARTTLS, but not against a production provider or with authentication.
- Graceful shutdown in `main.ts` has not been exercised, because Windows delivers no SIGTERM. Phase 8 can verify it in a container.

## Known dependency findings

`pnpm audit` reports 1 moderate finding, within M-SEC-03 (at most 5, with an action plan): `glob`
through `testcontainers > archiver`, a dev dependency that does not ship. Action: take the upstream
fix when Testcontainers updates `archiver`, and review on each Dependabot run.

Five earlier moderate findings in `qs` and `minimatch`, both from Stryker, are resolved through
`overrides` in `pnpm-workspace.yaml`. Remove them once Stryker's own ranges include the fixes.
