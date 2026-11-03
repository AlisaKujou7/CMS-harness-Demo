# Quality gate status

What is actually enforced today, measured against 05-METRICS §11. Update this table whenever a gate
changes. `pnpm gate` runs the local steps, and `pnpm gate:self-test` proves that the rules marked
**Self-tested** fail on a planted violation.

## G-03 PR gate

| Check                                                   | Metric                     | Status                                             |
| ------------------------------------------------------- | -------------------------- | -------------------------------------------------- |
| TypeScript compile and strict flags                     | M-TS-01..05                | Enforced. Self-tested                              |
| ESLint and Prettier, 0 warnings                         | M-LINT-01..03              | Enforced                                           |
| Complexity and size limits                              | M-CPX-01..07               | Enforced. Self-tested for complexity               |
| `any` and undocumented suppressions                     | M-DEBT-04..06              | Enforced. Self-tested for `any`                    |
| Unlinked TODO and FIXME                                 | M-DEBT-02                  | Enforced. Self-tested                              |
| Skipped and focused tests                               | M-TEST-05                  | Enforced. Self-tested for skipped tests            |
| Hexagonal rules                                         | M-HEX-01..05               | Enforced. Self-tested                              |
| Fake for every outbound port                            | M-HEX-06                   | Enforced. Self-tested                              |
| Use case without a spec                                 | M-HEX-07                   | Enforced as "a spec imports it". Self-tested       |
| Mutable domain fields and setters                       | M-HEX-08                   | Enforced for fields and setters. Self-tested       |
| Circular dependencies                                   | M-DEP-01                   | Enforced. Self-tested                              |
| Reactive rules                                          | M-RX-01,02,04..08          | Enforced. Self-tested for 01, 04, 06 and 08        |
| Query key convention, stream teardown                   | M-STATE-02,04              | Enforced as lint rules. Self-tested                |
| UI text in message files                                | NFR-I18N-03                | Enforced for JSX text and text props. Self-tested  |
| React hooks and JSX accessibility                       | NFR-USE-03                 | Enforced with lint, and axe in component tests     |
| Coverage, overall and per layer                         | §3.2, §3.3                 | Enforced across unit and Docker tests. Self-tested |
| Mutation score                                          | M-TDD-03, M-TEST-06        | Enforced on the in-process suite. Self-tested      |
| Mutation on domain and critical code                    | M-TEST-07, §3.3            | Enforced at 90% by group. Self-tested              |
| Duplication                                             | M-DUP-01                   | Enforced. Self-tested                              |
| Bundle budgets                                          | M-BUN-01..03               | Enforced                                           |
| E2E flows on the built SPA, axe with contrast, keyboard | G-04, 06-TEST-STRATEGY 9.2 | Enforced by `pnpm test:e2e`, in `pnpm gate`        |
| License allow-list                                      | M-LIC-01..03               | Enforced for production dependencies               |
| Dependency CVEs, critical and high                      | M-SEC-01,02,05             | Enforced                                           |
| Commit and PR title format                              | M-PR-06                    | Enforced                                           |
| Test-to-code ratio                                      | M-TDD-01,06                | Skipped until `origin/main` exists                 |
| Secret scan                                             | M-SAST-02                  | Enforced locally, in pre-commit and in CI          |
| SAST (CodeQL)                                           | M-SAST-01                  | CI workflow written, never run                     |

## Not enforced yet

| Check                              | Metric               | Arrives in                               |
| ---------------------------------- | -------------------- | ---------------------------------------- |
| Diff coverage on changed lines     | M-TDD-02             | With git                                 |
| Mutation on changed files only     | M-TDD-03             | With git                                 |
| OpenAPI validity and drift         | M-API-04             | Phase 5                                  |
| Lighthouse and Web Vitals          | M-BUN-04..08         | Needs a decision on where it runs        |
| Storybook and Chromatic            | 06-TEST-STRATEGY 8.6 | Needs a decision on the external service |
| Slice size and invalidation review | M-STATE-01, 03       | By review                                |
| Container scan, SBOM, signing      | G-05, M-INF-*        | Phase 8                                  |

## Not measured by design for now

- Cohesion and coupling (M-COH-\*), dependency depth (M-DEP-02) and module fan-out (M-DEP-03). No
  module exists yet, so revisit these at the Phase 3 architecture review.
- SonarQube debt ratio (M-DEBT-01) and test pyramid ratios (M-PYR-\*). The first needs a server, and
  the second means nothing until integration tests exist.
- Needs people or production: review turnaround, DORA, SLOs, load tests, G-06 to G-10.

## Known gaps in what passes

- Deployed environments must connect as a login in the `cms_app` role. A test proves the app works
  with only those privileges, and a trigger blocks changes for every role, but no environment is
  configured this way until phase 8. Migrations must keep running as the owner.
- Email delivery depends on `dist/worker.js` running, and a crash between commit and enqueue loses
  that email. Resending an invitation or a reset request recovers it.
- Mutation testing skips driven adapters (`adapters/out`), because they need containers. They are
  covered by the Docker tests at 100% line coverage for auth, but M-TEST targets of 70% for them are
  not measured.
- The critical path bar in §3.3 asks for 90% on the HTTP adapters of auth too. Only domain and
  application are held to it, and adapters only count toward the overall 80%.
- M-HEX-07 asks for an integration test per use case. The check proves that a spec imports each one.
- SMTP is tested against a real server with STARTTLS, but not against a production provider or with authentication.
- Graceful shutdown in `main.ts` has not been exercised, because Windows delivers no SIGTERM. Phase 8 can verify it in a container.

- M-BUN-02 is measured per file. The editor route is split into several files that each pass, but
  opening it downloads about 130 KB gzipped in total, over the 100 KB the metric asks of a route.
- Mutation testing of `cms-web` leaves out string and object literal mutants, since those are mostly
  styling, and message files, tokens and the app shell. M-TEST-07's layer bars are not measured for it.
- M-CPX-04 limits a function to 50 lines, but a React component is held to 200 lines, the limit M-RX-07
  writes for components, because its JSX is markup. Complexity limits still apply to it. Hooks and
  other functions keep the 50 lines.
- The axe scans in component tests leave out color contrast, since jsdom has no layout. The E2E
  accessibility flow checks it in a real browser, in both themes, on the main screens with no dialog open.
- `eslint-plugin-jsx-a11y` declares support up to ESLint 9. It runs under ESLint 10 today, and needs
  replacing if a later ESLint breaks it.

## Known dependency findings

`pnpm audit` reports 1 moderate finding, within M-SEC-03 (at most 5, with an action plan): `glob`
through `testcontainers > archiver`, a dev dependency that does not ship. Action: take the upstream
fix when Testcontainers updates `archiver`, and review on each Dependabot run.

Five earlier moderate findings in `qs` and `minimatch`, both from Stryker, are resolved through
`overrides` in `pnpm-workspace.yaml`. Remove them once Stryker's own ranges include the fixes.
