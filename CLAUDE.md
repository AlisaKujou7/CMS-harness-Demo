# CLAUDE.md

Headless CMS MVP built from the specifications in `AIAGENT_POC/`. `README.md` has the commands, and
`docs/harness-workflow.md` explains how the work is controlled.

## Working agreements

- Reply to the user in Thai. Code, commits and repository documents stay in English, except the Thai
  guides `docs/demo-guide.md` and `docs/harness-workflow.md`.
- Commit only after `pnpm gate` passes, and read its result first. The hook in `.claude/settings.json`
  refuses a commit otherwise, and refuses skipping git hooks.
- Local commits are approved per phase. Never push or merge unless the user asks, each time.
- Offer a code review at the end of a phase, then fix what the user chooses.
- Commit subjects are lowercase with a scope from `commitlint.config.mjs`, and body lines stay within
  100 characters. A commit of about 240 files overflows lint-staged, so split large ones.
- Run `pnpm gate:self-test` whenever a gate changes, and update `docs/quality/gates.md`.
- Where the specifications conflict, the stricter or more specific one wins. Record each interpretation in
  `docs/adr/0013-spec-conflicts.md`. Quality gate changes are a Tech Lead decision through an ADR.
- Report what ran and what did not. A check that never ran is not a pass.

## Rules of the code

- `cms-api` is hexagonal and `cms-web` is reactive (04-ARCH). Dependency rules are enforced, so fix a
  violation rather than suppressing it.
- After an API change run `pnpm openapi:generate` in `cms-api`, then `pnpm --filter cms-web openapi:types`,
  or the contract test fails and the SPA types go stale.
- Prisma stays at stable 7.10.1, not the `latest` release candidate. `react-router` stays on 7, because 8
  needs React 19.
- `cms-web` has a second tsconfig, `tsconfig.browser.json`, that keeps Node types out of browser source.

## Lessons from earlier phases

- Test the built SPA, not only dev. A chunk setting once crashed the editor in production only, and passed
  every other gate.
- Unit specs with mocks miss real integration faults, so check with E2E and `infra/scripts/smoke-flow.sh`.
- Code must run on Windows too. A path under `/tmp` once crashed the worker there.
- Rebuild images before trusting a Compose check. One round once ran on old images and looked like a pass.
- MUI marks what sits behind a modal `aria-hidden`, so role queries miss a toast there. Axe during a fade-in
  reports false contrast failures, so wait for finite animations first.

## On this machine (Windows)

- Write files with the Write tool and change them with Edit. Bash heredocs lose backslashes.
- In Git Bash, set `MSYS_NO_PATHCONV=1` for docker only, because it stops curl finding `/dev/null`.
