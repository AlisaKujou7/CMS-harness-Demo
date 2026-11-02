# GIT-WORKFLOW.md — Git Workflow & Conflict Resolution

## Content Management System (CMS) — MVP

| Field             | Value                                                       |
| ----------------- | ----------------------------------------------------------- |
| Document Type     | Git Workflow & Conflict Resolution Framework                |
| Document Version  | 1.0                                                         |
| Status            | Draft                                                       |
| Date              | 2026-05-11                                                  |
| Classification    | Internal                                                    |
| Workflow Models   | Git Flow (release-driven) + Trunk-Based Development (TBD)   |
| Conflict Framework| Interest-Based Relational (IBR) Approach                    |
| Companion Docs    | 01-Requirements, 02-SRS, 03-DESIGN, 04-ARCH, 05-METRICS, 06-TEST-STRATEGY, 07-OPS-ARCH |

---

## Table of Contents

1. Introduction
2. Workflow Philosophy
3. Branching Models — When to Use Which
4. Git Flow System
5. Trunk-Based Development (TBD)
6. Hybrid Model — How They Coexist
7. Commit Conventions
8. Pull Request Workflow
9. Code Review Practice
10. Merge & Integration Rules
11. Release & Tagging
12. Hotfix Workflow
13. Conflict Resolution — Interest-Based Relational (IBR) Approach
14. Merge Conflict Resolution (Technical)
15. Human Conflict Resolution (Process & Disagreements)
16. Escalation & Mediation
17. Rituals & Cadences
18. Anti-Patterns & Recovery
19. Tools & Automation
20. Appendices

---

## 1. Introduction

### 1.1 Purpose

This document defines **how the team uses Git** and **how the team resolves conflicts** — both technical (merge conflicts) and interpersonal (disagreements about design, scope, priorities) — using the **Interest-Based Relational (IBR) approach**.

The goal is to make the day-to-day mechanics of contribution **predictable** and the difficult moments of disagreement **constructive**.

### 1.2 Why Two Workflows

The team operates **two parallel models**, applied based on stream of work:

| Stream                            | Workflow                  | Why                                                  |
| --------------------------------- | ------------------------- | ---------------------------------------------------- |
| Day-to-day feature development    | **Trunk-Based Development** | Fast feedback, small batches, CI safety net (TDD + gates from 05-METRICS) |
| Release coordination & hotfixes   | **Git Flow (lightweight)**| Predictable release vehicle, clear hotfix path, version traceability |

These are not competing — they coexist. TBD describes how *commits land*; Git Flow describes how *releases ship*.

### 1.3 Audience

| Audience              | Primary Sections                |
| --------------------- | ------------------------------- |
| All Developers        | All                             |
| Tech Leads            | 6, 9, 10, 11, 13–16             |
| QA Engineers          | 8, 10, 11                       |
| DevOps                | 10, 11, 12                      |
| Product Owners        | 11, 13, 16                      |
| New Team Members      | 1, 2, 3, 7, 8, 13               |

---

## 2. Workflow Philosophy

### 2.1 Principles

1. **Main is always releasable.** Every commit on `main` passes all gates from 05-METRICS.
2. **Small batches.** Aim for PRs < 400 LOC. Larger PRs require pre-discussion.
3. **Short-lived branches.** Feature branches live < 2 days median, < 5 days max.
4. **Integrate continuously.** Pull main into your branch at least daily.
5. **Feature flags for incomplete work.** Don't hold back merges to "finish" a feature; merge behind a flag.
6. **TDD discipline gates the merge.** No production code without a preceding failing test (per 06-TEST-STRATEGY).
7. **Disagreements are signals, not threats.** Treat conflicts as information.
8. **People before positions.** When humans clash, separate the person from the problem (IBR core).

### 2.2 Three Promises We Make to Each Other

| # | Promise                                                                              |
| - | ------------------------------------------------------------------------------------ |
| 1 | I will not break main. If I do, I will revert immediately and triage later.          |
| 2 | I will review your PR within 1 business day, or tell you why I can't.                |
| 3 | When we disagree, I will name what I want AND what I need, and ask you to do the same. |

---

## 3. Branching Models — When to Use Which

### 3.1 Decision Tree

```
Is this a routine feature, bug fix, refactor, doc change?
  │
  ├─ YES → Trunk-Based Development (Section 5)
  │
  └─ NO ──┐
          │
          ├─ Is it a coordinated release (1.x.0)?
          │   └─ YES → Git Flow release branch (Section 4 + 11)
          │
          ├─ Is it a production hotfix (1.0.x)?
          │   └─ YES → Git Flow hotfix branch (Section 12)
          │
          └─ Is it a long-running spike that may be abandoned?
              └─ YES → Personal branch, NOT merged unless converted to TBD
```

### 3.2 Branch Types Inventory

| Branch                  | Lives in | Lifetime    | Mergeable to             |
| ----------------------- | -------- | ----------- | ------------------------ |
| `main`                  | origin   | permanent   | (none — receives merges) |
| `feature/<scope>-<short>`| origin  | ≤ 5 days    | `main` via PR            |
| `fix/<scope>-<short>`   | origin   | ≤ 2 days    | `main` via PR            |
| `chore/<scope>-<short>` | origin   | ≤ 2 days    | `main` via PR            |
| `release/<version>`     | origin   | ≤ 1 week    | `main` (and tagged)      |
| `hotfix/<version>-<short>`| origin | ≤ 24 hours  | `main` (and tagged)      |
| `spike/<short>`         | local / origin | ≤ 2 weeks | NOT merged; converted   |

Naming: lowercase, hyphens only. Scope is module name (`auth`, `content`, `media`) or `shared`/`infra`. Short description is 2–4 words.

✅ `feature/content-version-history`
✅ `fix/auth-refresh-token-rotation`
✅ `chore/upgrade-prisma-5.18`
✅ `release/1.1.0`
✅ `hotfix/1.0.3-publish-403-regression`

❌ `feature/JIRA-123` (no human context)
❌ `my-branch` (no type, no scope)
❌ `feature/big-refactor` (vague, likely too large)

---

## 4. Git Flow System

We use **lightweight Git Flow** — release and hotfix branches only. We deliberately omit `develop`, long-lived feature branches, and integration branches, because TDD + 98% coverage on main makes them unnecessary overhead.

### 4.1 What We Keep from Classic Git Flow

| Element             | Status      | Reason                                              |
| ------------------- | ----------- | --------------------------------------------------- |
| `main` as production reference | ✅ Kept | Single source of truth for "what's in prod"      |
| `release/*` branches | ✅ Kept     | Predictable cut for stabilizing a version           |
| `hotfix/*` branches  | ✅ Kept     | Production fixes without disrupting normal work     |
| Semantic version tags| ✅ Kept     | Traceable releases                                  |
| `develop` branch     | ❌ Dropped  | Replaced by trunk-based flow on `main`              |
| Long-lived `feature/*` | ❌ Dropped | Replaced by short-lived TBD branches              |
| Integration branches | ❌ Dropped  | CI is the integration                               |

### 4.2 Release Branch (`release/<version>`)

A `release/<version>` branch is cut from `main` when the team decides to **stabilize and ship** what's in main.

**Purpose**: allow late-stage hardening (smoke tests, release notes, last-minute critical fixes) without freezing all of main.

**Rules**:

1. Cut from `main` at an agreed commit.
2. Only **critical bug fixes** and **release notes** land here — no new features.
3. Each fix that lands here is **simultaneously cherry-picked or re-applied to `main`** (no fix lives only on the release branch).
4. Once stabilized, the branch is **tagged** (`v1.1.0`) and **merged back to main** if any fix-only commits exist there.
5. Deleted after the tag and merge-back.

**Lifecycle illustration**:

```
main:        A ── B ── C ── D ──────────── G ── (merge release back)
                       │                    ▲
                       │                    │
release/1.1.0:          C' ── E ── F ──── ─┘ (tag v1.1.0 here)
                                 │
                                 │ E, F also cherry-picked to main
                                 ▼
main:                ... ── C ── D ── E' ── F' ── G ── ...
```

### 4.3 Hotfix Branch (`hotfix/<version>-<short>`)

Used when production is broken and waiting for the next release is unacceptable.

See Section 12 for the full hotfix workflow.

### 4.4 Main Branch Rules

| Rule                                                                                 |
| ------------------------------------------------------------------------------------ |
| `main` is protected (see 05-METRICS §12.2).                                          |
| No direct pushes. Merges only via PR.                                                |
| At least one approving review.                                                       |
| All CI gates pass (G-03, G-04 from 05-METRICS).                                      |
| Linear history required (rebase or squash-merge).                                    |
| Signed commits required.                                                             |
| Force push: forbidden.                                                               |
| Deletion: forbidden.                                                                 |

---

## 5. Trunk-Based Development (TBD)

### 5.1 Core Mechanics

- **One trunk**: `main`.
- **Short-lived branches** (< 5 days) created from `main`, merged back via PR.
- **Continuous integration**: pull from `main` at least daily into your branch.
- **Feature flags** wrap incomplete work so PRs can merge before the feature is user-visible.

### 5.2 Daily Developer Loop

```
1. Sync:        git checkout main && git pull --rebase
2. Branch:      git checkout -b feature/<scope>-<short>
3. TDD cycle:   red → green → refactor → small commit (per 06-TEST-STRATEGY §6)
4. Sync often:  git fetch origin && git rebase origin/main  (at least daily)
5. Push:        git push -u origin feature/<scope>-<short>
6. Open PR early (even if WIP) — use Draft PR for visibility
7. Address review comments by adding commits (not amending) until approved
8. When green + approved: squash-merge to main
9. Delete branch
```

### 5.3 Feature Flags

Incomplete features merge to `main` behind a flag. The flag is removed in a follow-up PR after rollout.

Conventions:

- Flag name: `FEATURE_<UPPER_SNAKE>_ENABLED`.
- Default: `false` in `.env.example`.
- Documented in `infra/feature-flags.md` with owner, intent, expected removal date.
- Flags older than 90 days are reviewed; stale flags must be either promoted (removed, feature on always) or retired (code path deleted).

Example use:

```typescript
if (config.featureFlags.FEATURE_SCHEDULED_PUBLISH_ENABLED) {
  await scheduler.schedule(content, when);
} else {
  throw new FeatureNotAvailableError('schedule');
}
```

### 5.4 Why TBD With TDD

TBD only works if `main` stays green. TDD + the 98% coverage gate + mutation testing (per 05-METRICS) is what makes that practical:

- A test exists for every behavior change.
- A failing test cannot be merged.
- The author is the first to know if main breaks.
- Reverts are cheap because branches are small.

### 5.5 What TBD Avoids

| Avoided pattern        | Why                                                    |
| ---------------------- | ------------------------------------------------------ |
| Long-lived feature branches | Drift, painful merges, integration debt          |
| Big-bang merges        | Hard to review, high blast radius on regression        |
| `develop` branch       | An unnecessary integration layer; main IS the integration |
| "Code freeze" weeks    | Stops delivery; replaced by release branches when stabilization needed |

---

## 6. Hybrid Model — How They Coexist

### 6.1 Mental Model

```
                        TRUNK-BASED FLOW
                        (continuous, daily)
                              │
                              ▼
   ┌──────────────────────────────────────────────────────────┐
   │                                                            │
   │  ──● ──● ──● ──● ──● ──● ──● ──● ──● ──● ──● ──● ──●  main │
   │     ▲                          │                        │  │
   │     │                          │                        │  │
   │  feature/                  release/1.1.0          hotfix/  │
   │  fix/                      (stabilize, tag)       1.0.3    │
   │  chore/                                          (urgent)  │
   │                                                            │
   │                        GIT FLOW                            │
   │                        (release events, hotfixes)          │
   └──────────────────────────────────────────────────────────┘
```

### 6.2 Day-to-Day vs Release-Day

| Activity                     | Workflow used      |
| ---------------------------- | ------------------ |
| Write a feature              | TBD                |
| Fix a bug found in dev/staging| TBD                |
| Refactor                     | TBD                |
| Documentation change         | TBD                |
| Cut release v1.1.0           | Git Flow `release/`|
| Patch production while v1.1 is in progress | Git Flow `hotfix/` |
| Major architectural change   | TBD with feature flag + ADR |

### 6.3 Release Cadence

- **Default**: continuous deployment of `main` to **staging** on every merge.
- **Production deploys**: cut from `main` (or from a `release/` branch if stabilization is needed) on a deliberate cadence — typically weekly during MVP, biweekly later.

A release branch is **optional**: if `main` is already production-ready, tag it directly and deploy. Use a release branch only when stabilization work is expected to span more than a few hours.

---

## 7. Commit Conventions

### 7.1 Conventional Commits

We follow [Conventional Commits 1.0](https://www.conventionalcommits.org/). Format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:

| Type       | Use                                                    |
| ---------- | ------------------------------------------------------ |
| `feat`     | New user-facing capability                             |
| `fix`      | Bug fix                                                |
| `refactor` | Code change without behavior change                    |
| `perf`     | Performance improvement                                |
| `test`     | Adding or modifying tests                              |
| `docs`     | Documentation only                                     |
| `build`    | Build system / dependency changes                      |
| `ci`       | CI/CD pipeline changes                                 |
| `chore`    | Other maintenance (deps update, tooling)               |
| `revert`   | Reverting a previous commit                            |

**TDD-specific prefixes** (used during work, squashed at merge — see 7.3):

| Prefix       | Meaning                                |
| ------------ | -------------------------------------- |
| `red:`       | Failing test added                     |
| `green:`     | Test now passes                        |
| `refactor:`  | Behavior unchanged, code improved      |

**Scopes** (match module names from 04-ARCH):

`auth`, `users`, `content`, `media`, `audit`, `public-api`, `notifications`, `shared`, `infra`, `ci`, `docs`.

**Examples**:

```
feat(content): add scheduled publish

Implements scheduling via cron-driven worker that transitions
in_review → published when scheduled_at <= now.

Refs: CMS-142
```

```
fix(auth): reject refresh token reuse

When a previously-revoked refresh token is presented, invalidate
all tokens for the user and log a security audit event.

Fixes: CMS-203
```

```
test(content): add boundary tests for SEO description length

Covers exactly 160, 161, and 0 character cases.
```

### 7.2 Subject Line Rules

- ≤ 72 characters.
- Imperative mood ("add", not "added" or "adds").
- No trailing period.
- Lowercase first letter after colon.

### 7.3 Squash on Merge

PRs squash-merge into `main` by default. This means:

- The PR title becomes the squashed commit message — **the PR title must be a valid Conventional Commit**.
- Intermediate `red:` / `green:` / `refactor:` commits are collapsed.
- `main` history reads as one logical change per PR.

When to NOT squash:

- A PR contains multiple logically-independent changes (rare; usually split into multiple PRs instead).
- A revert PR — use `revert:` type with clear message.

### 7.4 Signed Commits

All commits to `main` must be signed:

```bash
git config --global user.signingkey <key>
git config --global commit.gpgsign true
```

GitHub displays "Verified" badge; CI rejects unsigned commits via branch protection.

---

## 8. Pull Request Workflow

### 8.1 PR Lifecycle

```
Draft → Ready for review → Reviewed → Changes requested ↺ → Approved → Merged → Branch deleted
```

### 8.2 Opening a PR

Open the PR **early**, even as a **Draft**, when:

- You want visibility on direction before going deep.
- You want CI to run.
- You've started but won't finish in one sitting.

Mark "Ready for review" only when:

- All CI gates pass locally.
- Self-review done.
- PR description is complete.
- Description includes screenshots/recordings for UI changes.

### 8.3 PR Title

Must be a Conventional Commit (it becomes the squashed commit message). Examples:

✅ `feat(content): add scheduled publish`
✅ `fix(media): reject upload when magic bytes mismatch declared mime`
✅ `refactor(auth): extract token rotation into domain service`

❌ `WIP`
❌ `Updates`
❌ `Fix bug`

### 8.4 PR Description Template

```markdown
## What
One-paragraph summary of the change.

## Why
Link to issue / requirement / bug report (FR-ID from 02-SRS where applicable).

## How
Brief description of the approach. Mention any architectural decisions.

## Test plan
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E test added/updated (if user flow affected)
- [ ] Manual verification steps:
  1.
  2.

## Risk
- Blast radius (which modules)
- Migration / data impact
- Rollback plan if relevant

## Screenshots / recordings
(for UI changes)

## Checklist
- [ ] Title is a Conventional Commit
- [ ] PR is < 400 LOC of production code (or split planned)
- [ ] Tests follow TDD (test exists for every behavior change)
- [ ] No `any` / `@ts-ignore` without justification
- [ ] OpenAPI spec updated (if API changed)
- [ ] Docs / runbooks updated (if operational change)
- [ ] Feature flag added (if incomplete work)
- [ ] Linked issue: CMS-___
```

### 8.5 Self-Review Before Requesting Review

Before clicking "Ready for review":

- Read the diff in GitHub's UI as if it weren't yours.
- Check tests cover the behavior.
- Check no debug/print statements remain.
- Check no secrets or sensitive values committed.
- Verify CI is green.

### 8.6 PR Size Discipline

| Size        | LOC (production code)     | Treatment                              |
| ----------- | -------------------------- | -------------------------------------- |
| Tiny        | ≤ 50                       | Fast track; can be reviewed in minutes |
| Small       | 51–200                     | Default; expected to review in ≤ 1 hr  |
| Medium      | 201–400                    | Acceptable; needs description care     |
| Large       | 401–800                    | Discouraged; reviewer may request split|
| Too large   | > 800                      | Must be split; review can refuse       |

If a PR exceeds 400 LOC, the description must justify why and identify split points considered.

---

## 9. Code Review Practice

### 9.1 Reviewer Responsibilities

| What the reviewer is responsible for                                                                |
| --------------------------------------------------------------------------------------------------- |
| Reading the entire diff (not just changed files).                                                    |
| Checking that tests describe behavior, not implementation (06-TEST-STRATEGY §3.3).                   |
| Verifying architecture rules (04-ARCH dependency rules, 05-METRICS §11.4 checks).                   |
| Asking questions when intent is unclear.                                                             |
| Approving when the code meets standards (not when it's perfect).                                     |
| Communicating respectfully (Section 13 applies to reviews too).                                      |

### 9.2 Author Responsibilities

| What the author is responsible for                                                                  |
| --------------------------------------------------------------------------------------------------- |
| Making the diff easy to review (small, focused, well-described).                                     |
| Responding to every comment, even if just to acknowledge.                                            |
| Distinguishing "I disagree" from "I will change it" explicitly.                                      |
| Resolving conversations only when the comment has been addressed.                                    |
| Re-requesting review after substantial changes.                                                      |
| Not merging until all conversations are resolved AND CI is green AND approval given.                 |

### 9.3 Review Comment Categories

We use **prefixes** on review comments to make intent explicit:

| Prefix          | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `must:`         | Blocking — author must address before merge                          |
| `should:`       | Strong recommendation — author should address or explain why not    |
| `nit:`          | Minor; author may ignore (style preference, naming taste)            |
| `question:`     | I want to understand; not necessarily a change request               |
| `praise:`       | This is good; explicit positive feedback                             |
| `suggestion:`   | Concrete alternative implementation (often with a code block)        |
| `thought:`      | Reflection; not actionable                                            |

Example:

> `must:` This branch is missing an audit event write. Per 02-SRS FR-AUDIT-02, publish must emit a `content.publish` audit event. Please add a test asserting the event is written.

> `nit:` Variable name `c` is short; consider `content` for readability.

### 9.4 Review Turnaround

| Promise                                                            | Target           |
| ------------------------------------------------------------------ | ---------------- |
| First response on a PR ready for review                             | ≤ 4 hours (business) |
| Full review                                                         | ≤ 1 business day |
| Re-review after author addresses comments                           | ≤ 4 hours (business) |

If you can't meet the SLA, comment on the PR within the SLA explaining when you will get to it, and ideally tag an alternate reviewer.

### 9.5 What Counts as Approval

Approval means: **"I have read this. I believe it is safe to merge and meets our standards. If something breaks because of it, I will help address it."**

Approval does NOT mean: "I would have written it exactly this way."

### 9.6 What Reviewer Should NOT Do

| Don't                                                                                  |
| -------------------------------------------------------------------------------------- |
| Approve without reading.                                                                |
| Reject without specifying what would unblock approval.                                  |
| Demand stylistic preferences that aren't in the style guide.                            |
| Hold a PR hostage over disagreement that should be escalated (see Section 13).          |
| Personalize criticism ("this is bad code" vs "this code has problem X because Y").     |
| Be silent: not commenting is worse than commenting that you're delayed.                 |

---

## 10. Merge & Integration Rules

### 10.1 Merge Method

**Squash and merge** is the default and only method enabled in repo settings, except:

- **Rebase merge** for `release/*` → `main` back-merge (to preserve individual commit history).
- **Merge commit (--no-ff)** never used.

### 10.2 Merge Prerequisites (Gate Chain)

In order, before "Merge" button becomes clickable:

1. CI G-03 PR-open gate passes (05-METRICS §11.4).
2. CI G-04 PR-merge gate passes (includes E2E).
3. At least one approving review.
4. All conversations resolved.
5. Branch up to date with `main` (rebase if not).
6. No "do-not-merge" / "WIP" label.

### 10.3 Who Clicks Merge

The **author** clicks merge. Not the reviewer. The author is responsible for:

- Confirming CI is green at the moment of merge.
- Knowing post-merge actions (e.g., toggle a feature flag, update a tracking ticket).
- Watching the post-merge CI run on `main`.

### 10.4 Post-Merge Author Responsibilities

| Within 30 minutes of merging                                                          |
| ------------------------------------------------------------------------------------- |
| Confirm `main` CI passes.                                                              |
| Confirm staging deploy passes smoke tests (G-06).                                      |
| Update tracking ticket (move to "Done" / "In staging").                                |
| Delete the branch.                                                                     |
| If `main` breaks → revert immediately (Section 18.2).                                  |

### 10.5 "Don't Break Main" Rule

If your merge causes `main` CI to fail:

1. **First** revert (within 15 min). The team's productivity depends on a green main.
2. **Then** triage what went wrong in a new branch.
3. **Never** "fix forward" in main when the fix is non-trivial. Fix forward is acceptable only for trivial issues (a typo in a comment, a flake re-run).

---

## 11. Release & Tagging

### 11.1 Versioning

Strict **Semantic Versioning** (SemVer 2.0):

- **MAJOR.MINOR.PATCH** (e.g., `1.4.2`).
- MAJOR: breaking API change.
- MINOR: backward-compatible feature.
- PATCH: backward-compatible fix.

For pre-release: `1.4.0-rc.1`, `1.4.0-rc.2`.

### 11.2 Tag Format

- Production tag: `v1.4.0`.
- Pre-release tag: `v1.4.0-rc.1`.
- Tags are signed (`git tag -s`).
- Tags trigger the deploy pipeline (per 07-OPS-ARCH §11).

### 11.3 Release Decision

Tech Lead, in consultation with PO, decides:

- Whether to cut a release branch or tag main directly.
- The version number (semver rules + judgment).
- The release window (per 07-OPS-ARCH §11.5).

### 11.4 Release Branch Procedure

```bash
# 1. Cut release branch
git checkout main
git pull --rebase
git checkout -b release/1.4.0
git push -u origin release/1.4.0

# 2. Bump version
# (update package.json, version constants, etc.)
git commit -am "chore(release): bump version to 1.4.0"

# 3. Stabilize: only critical fixes land here, ALSO cherry-picked to main
#    Each fix goes through normal PR review.

# 4. When stable, tag and merge back
git tag -s v1.4.0 -m "Release 1.4.0"
git push origin v1.4.0

# 5. Merge release branch back to main (rebase merge to preserve commits)
#    This is done via PR.

# 6. Delete release branch after merge
git push origin --delete release/1.4.0
```

### 11.5 Release Notes

Auto-generated from Conventional Commit messages between two tags by `git-cliff` or `release-please`.

Manual curation:

- Highlight breaking changes prominently.
- Group by user-facing impact.
- Include migration notes for schema changes.
- Link to relevant docs and FR IDs.

### 11.6 Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/) format. Updated on every release.

---

## 12. Hotfix Workflow

### 12.1 When to Hotfix

A hotfix is justified when:

- Production is broken (S1 / S2 severity, per 07-OPS-ARCH §18.1).
- Security vulnerability requires immediate patching.
- A regression makes a critical path unusable.

A hotfix is **not** justified when:

- Bug is annoying but workaroundable → next regular release.
- Fix is large or speculative → regular feature/fix branch.

### 12.2 Hotfix Procedure

```bash
# 1. Identify the production version
PROD_VERSION=$(git describe --tags --abbrev=0)   # e.g., v1.0.2

# 2. Cut hotfix branch from the production tag
git checkout -b hotfix/1.0.3-publish-403-regression v1.0.2

# 3. Write a failing regression test (TDD)
#    Commit: "test(content): regression test for publish 403 with valid editor"

# 4. Implement minimal fix
#    Commit: "fix(content): restore editor role check in publish use case"

# 5. Push and open PR against main
git push -u origin hotfix/1.0.3-publish-403-regression

# 6. Expedited review: 1 approver but reviewer SLA cut to 30 min for S1
#    All CI gates still apply — no shortcuts on tests.

# 7. After merge to main:
git checkout main
git pull --rebase
git tag -s v1.0.3 -m "Hotfix 1.0.3: publish 403 regression"
git push origin v1.0.3

# 8. Deploy v1.0.3 (per 07-OPS-ARCH §11)

# 9. Post-incident: schedule post-mortem within 48 hours (S1)
```

### 12.3 Hotfix from a Release Branch (Rare)

If a release branch (e.g., `release/1.4.0`) is in flight when a production hotfix on `v1.3.x` is needed:

- Hotfix is cut from the `v1.3.x` tag, not the release branch.
- After hotfix tag, **both `main` and the in-flight `release/1.4.0` branch** must absorb the fix (cherry-pick from the hotfix commits).

### 12.4 Hotfix Discipline

| Rule                                                                                  |
| ------------------------------------------------------------------------------------- |
| Hotfix carries a regression test that would have caught the bug.                       |
| Hotfix scope is minimal — only what's required to restore service.                     |
| Cleanup / refactor of the affected code happens in a follow-up regular PR.             |
| Hotfix is post-mortemed (S1/S2) within 48 hours.                                       |
| Hotfix never bypasses CI gates.                                                        |

---

## 13. Conflict Resolution — Interest-Based Relational (IBR) Approach

### 13.1 What IBR Is

The **Interest-Based Relational** approach (drawing on Roger Fisher & William Ury's *Getting to Yes* and the Harvard Negotiation Project, adapted for workplace use) treats conflicts as collaborative problems to solve, not contests to win.

It rests on **six principles**:

| # | Principle                                          | What it means in practice                                |
| - | -------------------------------------------------- | -------------------------------------------------------- |
| 1 | **Make sure good relationships are the first priority** | The way we disagree matters more than who is "right"  |
| 2 | **Keep people and problems separate**              | Critique the design, not the designer                    |
| 3 | **Pay attention to the interests being presented** | Ask "why?" — surface underlying needs, not surface demands |
| 4 | **Listen first, talk second**                      | Restate the other side's view before advancing yours     |
| 5 | **Set out the facts**                              | Build a shared base of truth before negotiating          |
| 6 | **Explore options together**                       | Generate alternatives jointly before picking one         |

### 13.2 Why IBR for This Team

- Software disagreements (design choices, code style, scope) recur. A consistent approach reduces friction-cost.
- TDD and architecture rules create many decision points; many are matters of judgment.
- Code review is structured disagreement. IBR makes review feedback land better.
- Small teams cannot afford lingering interpersonal tension.

### 13.3 IBR in Plain Words

| Position-based (avoid)                          | Interest-based (use)                                       |
| ----------------------------------------------- | ---------------------------------------------------------- |
| "We must use Repository pattern here."          | "I want this code to be easy to swap a DB later — what approach gets us there?" |
| "This PR is wrong, change it."                  | "I'm concerned about X because Y. Can we explore alternatives?" |
| "I don't want to write tests for this."         | "What I need is to finish faster on this slice — can we discuss what level of test gives us safety without slowing me?" |
| "You always over-engineer."                     | "When I see this many abstractions, my concern is maintainability. Can we walk through the alternatives?" |

### 13.4 The IBR Conversation Template

When two people disagree on a technical or process matter, run through this in order. It can take 5 minutes or 50; usually 10–15.

```
Step 1 — Reaffirm relationship
   "I value working with you and I want us to land on something we both stand behind."

Step 2 — State facts you both agree on
   "Here's what I think we both see:
      - The PR adds a new use case.
      - Coverage is at 99%.
      - Mutation score on changed files is 76%."

Step 3 — State your interest (not position)
   "What I care about is X (e.g., not regressing critical-path mutation score
   below 90% per 05-METRICS §3.3)."

Step 4 — Ask for their interest
   "What's driving your view here? What do you need this PR to accomplish?"

Step 5 — Listen and reflect
   "Let me see if I have it right: you need to ship this by Thursday
   for the demo, and adding more mutation-killing tests feels like scope creep."

Step 6 — Explore options together
   "Given both of those, options I can think of:
      a) Merge as-is with a follow-up ticket to raise mutation score by Friday.
      b) Add 2 targeted tests now (15 min), defer broader coverage.
      c) Land behind a feature flag, demo on staging, harden after.
   What occurs to you?"

Step 7 — Pick & document
   "Let's go with (b). I'll add a comment with the tickets we're deferring."
```

This is **not** a script to memorize verbatim. It's a structure to fall back on when a conversation is sliding into positions.

### 13.5 Common Disagreement Patterns & IBR Responses

#### 13.5.1 "I think this code is over-engineered"

- **Position-based reaction**: argue about "over"-engineering definitions.
- **IBR move**: surface the interest behind the comment.
  - Reviewer: "I'm worried we're building flexibility we don't have a near-term need for, which makes the code harder to learn for new joiners."
  - Author: "What I'm trying to protect against is the future case where we need to swap X. What level of abstraction would feel right to you?"

#### 13.5.2 "Tests are slowing me down"

- IBR move: separate the *level* of testing from the *practice* of testing.
  - "What I need is to keep our 98% coverage gate. What you need is to finish this slice faster. Where can we trade? Maybe smaller scope per PR? Maybe a temporary feature flag with follow-up coverage?"

#### 13.5.3 "This architecture rule doesn't make sense here"

- IBR move: refer to the document where the rule lives; if rule is wrong, change the rule (ADR), don't bypass it on the PR.
  - "Let's check 04-ARCH §4.8. If the rule genuinely doesn't fit this case, that's an ADR conversation — but I don't think we should silently break it in this PR."

#### 13.5.4 "I disagree with the priority"

- IBR move: invoke the PO. Priorities are PO's call; engineers can lobby but not unilaterally re-order.

#### 13.5.5 Stylistic preferences during review

- IBR move: if it's not in the style guide, it's a `nit:`. Author may ignore.
  - "Style preferences that aren't codified shouldn't block merges; if you feel strongly, propose a rule via PR to the style guide."

### 13.6 IBR Mantras

Short phrases to keep handy:

- "Help me understand what you need."
- "What's driving this concern?"
- "What would it take for you to feel OK with this?"
- "Here's what I think I'm hearing — am I right?"
- "Can we look at the facts together?"
- "What options haven't we considered?"
- "I'd rather have you push back now than be unhappy after we ship."

### 13.7 When IBR Doesn't Apply

| Situation                                          | Approach                                  |
| -------------------------------------------------- | ----------------------------------------- |
| Safety / security violation                        | Stop immediately; not negotiable          |
| Quality gate violation                              | Block merge; not negotiable                |
| Harassment, discrimination, bullying               | Escalate to HR / leadership; out of IBR scope |
| One-sided refusal to engage                         | Escalate to Tech Lead (Section 16)         |
| Pattern of bad-faith argument                       | Document; escalate                         |

IBR assumes both parties are operating in good faith and willing to engage. When that's not true, IBR is not the right tool — escalation is.

---

## 14. Merge Conflict Resolution (Technical)

### 14.1 Prevention First

The best conflict resolution is fewer conflicts. Achieved by:

- Short-lived branches (< 5 days).
- Daily rebase on `main`.
- Small PRs (< 400 LOC).
- Modular code (per 04-ARCH module boundaries) so two people are less likely to touch the same file.

### 14.2 Standard Conflict Resolution

When `git rebase origin/main` reports conflicts:

```bash
# 1. Identify conflicting files
git status

# 2. For each file, inspect the conflict
git diff <file>

# 3. Resolve:
#    a) If your change supersedes main's: keep yours
#    b) If main's change supersedes yours: keep theirs
#    c) Most common: integrate both changes manually

# 4. Run tests AFTER resolving — conflicts often hide logic errors
pnpm test

# 5. Mark resolved
git add <file>

# 6. Continue
git rebase --continue
```

### 14.3 When Conflict Is Complex

If the resolution is non-obvious:

- Pause. Don't power through.
- Open the conflict files side-by-side with the commits on each side.
- Reach out to the author of the conflicting commit on `main` — they have context you don't.
- Consider whether the conflict reveals a deeper design issue (two PRs are doing related work that should be coordinated).

### 14.4 Conflict Categories & Resolutions

| Conflict type                          | Likely cause                                      | Resolution                                  |
| -------------------------------------- | ------------------------------------------------- | ------------------------------------------- |
| Same file, different lines             | Two PRs touched same module                       | Usually mechanical: keep both changes       |
| Same file, same lines                  | Two PRs changed the same logic                    | Coordinate with the other author — IBR conversation |
| Import order / formatting              | Tool auto-formatted differently                   | Re-run formatter; trust tool output         |
| Lockfile (`pnpm-lock.yaml`)            | Two PRs changed deps                              | Delete lockfile; `pnpm install` regenerates|
| OpenAPI / generated files               | Codegen producing different output                | Re-run codegen; trust the regenerated output |
| Schema migration (Prisma)              | Two PRs added migrations                          | Coordinate timestamps; squash if related; otherwise both keep, ordered by timestamp |
| Feature flag config                     | Two PRs added flags                               | Mechanical merge; both flags kept           |
| Conflicting refactors                   | One PR moved/renamed; another edited the old location | Coordinate — usually need IBR conversation about scope |

### 14.5 Rebase vs Merge from Main

We **rebase** feature branches onto `main`, not merge `main` into the branch. Reasons:

- Linear history easier to read.
- Squash-merge erases merge commits anyway; rebases keep the diff clean.
- Forces resolving conflicts incrementally per commit rather than as one giant blob.

```bash
# Daily sync (preferred)
git fetch origin
git rebase origin/main

# NOT this:
# git merge origin/main   ← creates merge commits in feature branch
```

### 14.6 When Rebase Goes Wrong

If a rebase produces a worse result than the original branch:

```bash
# Abort
git rebase --abort

# Or, recover from reflog
git reflog
git reset --hard HEAD@{N}   # where N is the commit before the rebase started
```

Force-push (`git push --force-with-lease`) is allowed on **your own feature branches** but never on `main` or shared branches.

---

## 15. Human Conflict Resolution (Process & Disagreements)

### 15.1 Categories of Human Conflict

| Category                          | Examples                                                  |
| --------------------------------- | --------------------------------------------------------- |
| Design disagreement               | Choice of pattern, naming, abstraction level              |
| Scope disagreement                | What's in this PR vs follow-up                            |
| Priority disagreement             | What to work on next                                      |
| Style / taste                     | Variable naming, comment style                            |
| Process disagreement              | Whether to skip a check, how to handle a waiver           |
| Interpersonal friction            | Tone in reviews, perceived disrespect                     |

### 15.2 Resolution Pathway

```
Step 0: Pause. Take a breath. Re-read what you wrote.
   │
   ▼
Step 1: Try IBR conversation directly (Section 13.4)
   │   (Most disagreements end here.)
   │
   ▼ (if unresolved)
Step 2: Move to synchronous (DM, voice call, in-person)
   │   Text mediums escalate tone. Voice de-escalates.
   │
   ▼ (if unresolved)
Step 3: Bring a third party (peer, Tech Lead) as facilitator
   │   Not arbiter — facilitator. They run IBR with you.
   │
   ▼ (if unresolved)
Step 4: Tech Lead decides (Section 16.2)
   │   The decision is recorded as an ADR if it sets precedent.
   │
   ▼ (rare)
Step 5: Escalate beyond Tech Lead
   │   Only when norms or values are at stake, not technical preference.
```

### 15.3 Rules of Engagement in Disagreement

| Do                                                  | Don't                                              |
| --------------------------------------------------- | -------------------------------------------------- |
| Critique the code or decision                       | Critique the person                                |
| Use "I" statements ("I'm concerned that...")        | Use "you" accusations ("you always...")            |
| Cite specific evidence (file, line, doc reference)  | Generalize ("this is bad")                         |
| Ask questions to understand                         | Assume motive                                      |
| Acknowledge the other side's interest               | Dismiss their interest                              |
| Propose alternatives                                | Just say "no"                                      |
| Take it to private if heated                        | Keep going in a public channel/thread              |
| Step away and resume later                          | Push through fatigue or anger                      |

### 15.4 Asynchronous Conflict Hygiene

Most code review happens async. Text amplifies tone. To compensate:

- **Default to charitable interpretation** of what the other person wrote. Assume they meant well.
- **Use prefixes** (`must:`, `nit:`, `question:`) from §9.3 to signal intent.
- **Acknowledge effort** before suggesting changes. ("Thanks for splitting this up — much easier to review. One thing I'd like to think about...")
- **End feedback with a question or invitation**, not a verdict.
- **Re-read before sending**; remove anything that could land as dismissive.
- **Add emoji sparingly but intentionally** — a 👍 or 🙏 can soften a critique.

### 15.5 When You Made the Mistake

When you realize you were wrong (in a review you gave, in code you wrote, in a tone you used):

- Acknowledge it explicitly. "You're right; my original comment missed the point. Let's go with your approach."
- Don't over-apologize. One clear acknowledgment is more credible than five.
- Do the follow-through. If you said you'd update a comment / write a test / change an approach, do it.
- Move on. Don't dwell; the team needs you focused.

### 15.6 When You Receive Critical Feedback

- Read it twice before responding.
- Notice your reaction. If you feel defensive, that's data — don't respond from there.
- Separate the critique of the work from your sense of self-worth.
- If the critique seems wrong, ask a clarifying question before pushing back.
- If the critique is right, say so and act on it.
- It's OK to need time. "Let me sit with this and reply tomorrow" is a valid response.

---

## 16. Escalation & Mediation

### 16.1 Decision Authority Map

| Decision type                                        | Authority                            |
| ---------------------------------------------------- | ------------------------------------ |
| Code-level design within a module                    | PR author + reviewer consensus       |
| Cross-module architecture                             | Tech Lead (after team discussion)    |
| Architecture rule changes (04-ARCH dependency rules) | Tech Lead via ADR                    |
| Quality gate threshold changes (05-METRICS)          | Tech Lead via ADR                    |
| Process changes (this doc)                           | Tech Lead with team input            |
| Priority / scope                                     | Product Owner                        |
| Release timing                                       | Tech Lead + PO                       |
| Hotfix go/no-go                                      | Tech Lead (or on-call if TL absent)  |
| Waiver approvals                                     | Tech Lead (per 05-METRICS §15)       |
| People matters                                       | Manager / HR                         |

### 16.2 Tech Lead as Tie-Breaker

When team can't reach consensus through IBR within reasonable time:

1. Tech Lead listens to both sides (each gets equal floor time).
2. Tech Lead restates the interests at stake.
3. Tech Lead decides and explains the reasoning.
4. Decision is recorded (PR comment, ADR if precedent-setting).
5. Team commits to the decision — *disagree and commit*.

"Disagree and commit" is a real thing: you can voice strong disagreement during the decision phase and still execute fully once the decision is made. The team relies on this to move forward.

### 16.3 When Tech Lead Is Conflicted

If Tech Lead is a party to the disagreement (e.g., reviewing their own peer's PR):

- Tech Lead recuses from the decision role.
- A peer Tech Lead from another team, or the engineering manager, acts as decider.

### 16.4 Post-Conflict Hygiene

After a hard disagreement is resolved:

- Don't carry it forward. The decision is the decision.
- Don't relitigate it in adjacent PRs.
- Do retrospect on the **process** at a future retro — was this avoidable? Is there a rule to add?

---

## 17. Rituals & Cadences

### 17.1 Daily

| Ritual                       | Time            | Purpose                                          |
| ---------------------------- | --------------- | ------------------------------------------------ |
| Async standup (in Slack)     | Morning         | What I did / will do / blockers                  |
| PR review SLAs               | Throughout day  | ≤ 4hr first response                             |
| Main branch monitor          | Continuous      | Anyone may revert to keep main green             |

### 17.2 Weekly

| Ritual                       | Time            | Purpose                                          |
| ---------------------------- | --------------- | ------------------------------------------------ |
| Team sync (30 min)           | Monday          | Plan the week, surface cross-cutting work        |
| Quality review (15 min)      | Monday          | Coverage drift, flakes, security findings        |
| Retro (30 min)               | Friday          | What went well / didn't / one experiment to try  |

### 17.3 Per Sprint / Iteration

| Ritual                       | Cadence         | Purpose                                          |
| ---------------------------- | --------------- | ------------------------------------------------ |
| Sprint planning              | Start of sprint | Commit to scope                                  |
| Demo                         | End of sprint   | Show what shipped                                |
| Retrospective (extended)     | End of sprint   | Process improvements                              |

### 17.4 Per Release

| Ritual                       | Trigger         | Purpose                                          |
| ---------------------------- | --------------- | ------------------------------------------------ |
| Release readiness review     | Before tagging  | Check release notes, gates, runbooks             |
| Post-release watch (15 min)  | After deploy    | G-08 monitoring per 07-OPS-ARCH                  |
| Post-mortem (if S1/S2)       | Within 48 hr    | Blameless analysis of incident                   |

### 17.5 Quarterly

| Ritual                       | Cadence         | Purpose                                          |
| ---------------------------- | --------------- | ------------------------------------------------ |
| ADR review                   | Quarterly       | Are decisions still valid?                       |
| Architecture review          | Quarterly       | Drift from 04-ARCH? New ADRs needed?             |
| Workflow retrospective       | Quarterly       | Is this Git workflow working? Adjust if not.     |
| Critical path review         | Quarterly       | Is the critical path list still accurate? (05-METRICS §3.3) |

---

## 18. Anti-Patterns & Recovery

### 18.1 Anti-Patterns to Avoid

| Anti-pattern                                  | Why it's bad                                            | Recovery                                        |
| --------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| "Just this once" bypass of CI gates           | Erodes trust in the gates; defects slip                  | Reject. Use waiver process (05-METRICS §15)     |
| Force-pushing to `main`                        | Destroys other people's work and history                 | Restore from reflog; rotate access; post-mortem |
| Long-lived feature branches                    | Drift, painful merges                                    | Rebase often; split into smaller PRs            |
| Merging your own PR without review              | Skips the safety net                                    | Revert; re-open with reviewer                   |
| Approving without reading                       | False positive on quality                              | Tech Lead intervention; recalibrate reviewer    |
| Commenting on personality, not code             | Damages relationships                                    | Apologize; refer to §15.3 rules                  |
| Reopening settled debates in new PRs            | Drains energy; ignores team's decision                   | Tech Lead invokes "disagree and commit"          |
| Hiding incomplete work in big PRs               | Hard to review; high blast radius                       | Use feature flags + small PRs                    |
| Treating tests as optional                      | Breaks TDD discipline; lowers mutation score             | Block PR; require tests; coach if pattern        |
| Conflating "ready for review" with "merge me now" | Pressures reviewers; lowers review quality           | Author waits patiently; reviewer SLA respected   |

### 18.2 Recovery from a Broken `main`

```bash
# Within 15 minutes of discovering main is broken:

# Option A: Revert the offending commit
git checkout main
git pull --rebase
git revert <bad-sha>     # creates a "revert: ..." commit
git push origin main

# Option B (rare, only if revert is non-trivial): roll back to last good
# Requires admin override of branch protection. Use only as last resort.

# After main is green:
# 1. Notify the team in Slack
# 2. The original PR author opens a new PR with the fix + tests
# 3. Post-mortem if pattern is recurring
```

### 18.3 Recovery from Force-Push Damage

If someone force-pushed to a shared branch (intentionally or by mistake) and overwrote work:

```bash
# Reflog is your friend
git reflog show origin/main   # shows recent ref states

# Identify the commit before the force push
git checkout <pre-force-push-sha>
git branch recovery
git push origin recovery

# Compare; if recovery has lost work, open a PR to restore
```

Branch protection prevents this on `main`; recovery procedures are documented for feature/shared branches.

### 18.4 Recovery from a Bad Merge to a Release Branch

If a fix merged to `release/1.4.0` was never cherry-picked to `main`, and then `release/1.4.0` is deleted:

- The fix exists only on the v1.4.0 tag and in production.
- Recovery: cherry-pick from the tag into a new PR against `main`:

```bash
git checkout main
git checkout -b fix/main-missing-1.4.0-fix
git cherry-pick <commit-sha-on-tag>
git push -u origin fix/main-missing-1.4.0-fix
# open PR
```

Prevent recurrence by enforcing "every release branch fix must also have a tracking PR to main."

---

## 19. Tools & Automation

### 19.1 Repository Configuration

| Setting                                  | Value                                    |
| ---------------------------------------- | ---------------------------------------- |
| Default branch                           | `main`                                   |
| Merge methods enabled                    | Squash only (rebase enabled for release back-merge) |
| Auto-delete branches after merge          | ✅ Enabled                                |
| Require linear history                   | ✅ Enabled                                |
| Require signed commits                   | ✅ Enabled                                |
| Require PR before merging                | ✅ Enabled                                |
| Require approvals                        | 1                                        |
| Dismiss stale approvals                  | ✅ Enabled                                |
| Require status checks                    | All G-03 + G-04 (05-METRICS)             |
| Require branches up-to-date              | ✅ Enabled                                |
| Allow force pushes to `main`             | ❌ Disabled                               |
| Allow deletion of `main`                 | ❌ Disabled                               |

### 19.2 Local Tooling

| Tool          | Use                                                  |
| ------------- | ---------------------------------------------------- |
| `git`         | ≥ 2.40 with `pull.rebase = true` default             |
| `commitlint`  | Local hook for Conventional Commits                  |
| `husky`       | Pre-commit + pre-push gates (05-METRICS §11.2–11.3)  |
| `lint-staged` | Runs lint/format/type-check on staged files only     |
| `gh` (GitHub CLI) | Opening PRs, listing reviews, fetching CI status |
| GPG / SSH signing | Signed commits                                    |

Recommended `.gitconfig` snippet:

```ini
[pull]
    rebase = true
[rebase]
    autoStash = true
    autoSquash = true
[push]
    default = current
    autoSetupRemote = true
[commit]
    gpgsign = true
[diff]
    algorithm = histogram
    colorMoved = default
[merge]
    conflictstyle = zdiff3
```

### 19.3 Automation in PR Pipeline

Already documented in 05-METRICS §11–12. Summary:

- Lint, type, architecture, unit, integration, mutation, security, coverage gates run on every PR push.
- E2E runs on PR-merge gate.
- Auto-generated PR comment shows quality report.
- Branch protection prevents merge until all green.
- Dependabot opens weekly dep update PRs.
- Auto-rebase bot (optional) keeps PRs up-to-date with `main`.

### 19.4 Useful Aliases

```bash
# ~/.gitconfig
[alias]
    co = checkout
    br = branch
    st = status -sb
    cm = commit -s -m
    last = log -1 HEAD
    unstage = reset HEAD --
    sync = !git fetch origin && git rebase origin/main
    cleanup = !git branch --merged main | grep -v 'main\\|release/\\|hotfix/' | xargs -r git branch -d
    pr = !gh pr create --fill
    review = !gh pr view --web
```

---

## 20. Appendices

### 20.1 Appendix A — Quick Reference Cheat Sheet

```
┌────────────────────────────────────────────────────────────────┐
│  CMS Git Workflow — Cheat Sheet                                 │
├────────────────────────────────────────────────────────────────┤
│  Start work:                                                    │
│    git checkout main && git pull --rebase                       │
│    git checkout -b feature/<scope>-<short>                      │
│                                                                  │
│  TDD loop:                                                      │
│    Write failing test → commit "red: ..."                       │
│    Make it pass → commit "green: ..."                           │
│    Improve → commit "refactor: ..."                             │
│                                                                  │
│  Sync (daily minimum):                                          │
│    git fetch origin && git rebase origin/main                   │
│                                                                  │
│  Open PR:                                                       │
│    gh pr create --fill   (title = Conventional Commit)          │
│    Mark Draft if not ready                                      │
│                                                                  │
│  Merge:                                                         │
│    All gates green + 1 approval + conversations resolved        │
│    Click "Squash and merge"                                     │
│    Delete branch                                                 │
│                                                                  │
│  Tag release:                                                   │
│    git tag -s v1.x.y -m "Release 1.x.y"                         │
│    git push origin v1.x.y                                       │
│                                                                  │
│  Hotfix:                                                        │
│    git checkout -b hotfix/<version>-<short> <prod-tag>          │
│    Test-first fix → PR → merge → tag → deploy                   │
│                                                                  │
│  Broken main? REVERT FIRST, debug after:                        │
│    git revert <bad-sha> && git push origin main                 │
│                                                                  │
│  Disagreement?                                                  │
│    1. Reaffirm relationship                                      │
│    2. State facts you agree on                                  │
│    3. State YOUR interest (not position)                        │
│    4. Ask for THEIR interest                                    │
│    5. Reflect what you heard                                    │
│    6. Explore options together                                  │
│    7. Pick and document                                         │
└────────────────────────────────────────────────────────────────┘
```

### 20.2 Appendix B — Worked Example: Feature With Conflict

A realistic scenario showing the full workflow including an IBR moment.

```
Day 1 (Alice)
  git checkout main && git pull --rebase
  git checkout -b feature/content-scheduled-publish
  Write red test → commit
  Write green code → commit
  Push, open Draft PR for visibility

Day 2 (Alice)
  More TDD cycles
  git fetch && git rebase origin/main   (clean, no conflicts)
  Mark PR Ready for review
  Request review from Bob

Day 2 (Bob, 3 hours later)
  Reads PR diff
  Leaves comments:
    must:    "PR is missing audit event for scheduled publish per 02-SRS FR-AUDIT-02"
    should:  "Worker polling interval is hardcoded; please move to env"
    nit:     "Variable name `s` could be `scheduledAt`"
    praise:  "Nice extraction of SchedulerService — clean boundary"

Day 2 (Alice)
  Addresses `must:` → adds test + impl for audit event
  Addresses `should:` → adds WORKER_SCHEDULED_PUBLISH_INTERVAL_SEC env var
  Ignores `nit:` (variable is loop-local, short OK)
  Resolves conversations
  Re-requests review

Day 2 (Bob)
  Re-reviews
  Notices Alice didn't address the `nit:`
  Disagrees but doesn't escalate (it was a nit)
  Approves

Day 2 (Alice)
  CI is green. All conversations resolved.
  But — during rebase, conflict with main:
    Another PR (Carol's) also added a row to a Prisma migration.

Day 2 (Alice, conflict resolution)
  git rebase origin/main → conflict on prisma/migrations/...
  
  Inspects: Carol's migration timestamp is later, but Alice's was started first.
  Renames Alice's migration timestamp to be AFTER Carol's.
  Re-runs `prisma migrate deploy` locally → both migrations apply cleanly.
  Tests pass.
  git add → git rebase --continue
  Force-push: git push --force-with-lease

Day 2 (Alice)
  CI re-runs, green.
  Clicks "Squash and merge."
  Branch deleted.
  Watches main CI → green.
  Watches staging deploy → smoke tests pass.
  Updates Jira ticket.

Day 2 (Bob, follow-up)
  Bob realizes the `nit:` he raised actually had a real point — `s` 
  appears in two nested scopes, slightly confusing.
  Opens a tiny follow-up PR: refactor(content): rename loop var s → scheduledAt
  Self-deprecating PR description: "Bob being picky. Approve only if you agree."
  Alice approves quickly.
  Merges.

End state:
  - Feature shipped.
  - Audit + env coverage added.
  - Naming improved.
  - No grudges.
  - Bob and Alice still want to pair on the next thing.
```

### 20.3 Appendix C — Worked Example: IBR in a Real Disagreement

**Setup**: Reviewer Dana flags a PR by author Eli as "over-engineered". Eli feels frustrated.

**Position-based version (avoid)**:

> Dana: "This is over-engineered. Simplify."
> Eli: "It's not over-engineered. You don't understand the use case."
> Dana: "I understand fine. This adds three layers we don't need."
> Eli: "Fine, I'll inline it." (passive-aggressive, won't actually agree)

**IBR version (use)**:

> Dana: `should:` "I'm a bit concerned about the three new abstractions here (PublishScheduler, ScheduledJobAdapter, ScheduledJobPort). My worry is that we're paying maintainability cost for flexibility we don't have a concrete need for yet. What's driving the layering?"
>
> Eli: "Thanks for the question. Two things drive it: (1) the architecture rule that infrastructure can't be referenced from application code (04-ARCH §4.8) — so we need a port. (2) I expect we'll add SNS-triggered jobs next quarter and want a clean extension point.
>
> Dana: "OK, the port for (1) makes sense to me. On (2) — is there a way to add the port now without the SNS-specific adapter, so we don't carry code we're not using?"
>
> Eli: "Yes, totally. I can drop the SNS stub. Just the port + the cron adapter. Want me to do that?"
>
> Dana: "Yes please. Then I'm happy to approve."
>
> Eli: [updates PR] "Done. Removed the SNS stub. PR is now 80 LOC smaller."
>
> Dana: "Approved. Thanks for being open to changing this."
>
> Eli: "Thanks for pushing on it — the smaller version is genuinely better."

The technical outcome is improved, AND the relationship is strengthened.

### 20.4 Appendix D — Glossary

| Term                          | Definition                                                       |
| ----------------------------- | ---------------------------------------------------------------- |
| Trunk-Based Development (TBD) | A branching model where all developers work on a single trunk (`main`) with short-lived branches |
| Git Flow                      | A branching model with explicit release and hotfix branches      |
| Conventional Commits          | A specification for adding human and machine-readable meaning to commit messages |
| Squash merge                  | Merging a PR by combining all its commits into one               |
| Rebase                        | Re-applying commits onto a new base                              |
| Force-push                    | Overwriting a remote branch's history; restricted via branch protection |
| Branch protection             | GitHub feature preventing direct push, force-push, or unreviewed merge to specified branches |
| Feature flag                  | Code-level toggle allowing incomplete features to merge safely    |
| Interest-Based Relational (IBR) | A conflict-resolution framework prioritizing relationships and underlying interests over surface positions |
| Position                      | What someone says they want                                       |
| Interest                      | Why they want it (the underlying need)                            |
| Disagree and commit           | Voicing disagreement during decision-making but executing fully once decided |
| ADR                           | Architecture Decision Record                                      |
| Hotfix                        | Urgent production fix branched from the production tag           |
| `--force-with-lease`          | Safer force-push that fails if the remote moved unexpectedly     |
| Cherry-pick                   | Applying a specific commit from one branch onto another          |
| Linear history                | Commit history with no merge commits — only sequential commits   |
| Blameless post-mortem         | Incident review focused on systems and processes, not individuals|

### 20.5 Appendix E — IBR Phrase Bank

Print this out. Keep it next to your monitor for the first month.

```
OPENING THE CONVERSATION
  "Can we talk about <topic>? I want to make sure we land somewhere good."
  "I value working with you and I want us to figure this out together."

STATING YOUR INTEREST
  "What I'm concerned about is..."
  "What I need from this PR/decision is..."
  "What I care about here is..."

ASKING ABOUT THEIRS
  "Help me understand what's driving your view."
  "What's the goal you're trying to protect?"
  "What would feel right to you?"

LISTENING & REFLECTING
  "Let me see if I have this right: you're saying..."
  "What I'm hearing is..."
  "Did I get that?"

EXPLORING OPTIONS
  "What if we tried..."
  "Are there options we haven't thought of?"
  "Could we split this into <X> and <Y>?"
  "What's the lowest-cost thing that would address both our concerns?"

LANDING THE DECISION
  "OK, let's go with <X>. I'll <action>; can you <action>?"
  "I disagree but I can commit to this."
  "Let's try it and revisit if it doesn't work."

REPAIR (when something went wrong)
  "I came across more harshly than I meant. Let me try again."
  "You're right; I was wrong about <X>. Let's do it your way."
  "I noticed I'm getting frustrated; can we pick this up tomorrow?"
```

### 20.6 Appendix F — Document Change Log

| Version | Date       | Author | Change                                  |
| ------- | ---------- | ------ | --------------------------------------- |
| 1.0     | 2026-05-11 | —      | Initial Git workflow + IBR              |

---

**End of Document**
