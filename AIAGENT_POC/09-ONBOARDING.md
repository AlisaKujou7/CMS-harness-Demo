# ONBOARDING.md — Developer Onboarding Guide

## Content Management System (CMS) — MVP

| Field             | Value                                            |
| ----------------- | ------------------------------------------------ |
| Document Type     | Developer Onboarding Guide                       |
| Document Version  | 1.0                                              |
| Status            | Draft                                            |
| Date              | 2026-05-11                                       |
| Classification    | Internal                                         |
| Target Audience   | New engineers joining the CMS team               |
| Estimated Read    | 60–90 minutes (first pass)                       |
| Companion Docs    | 01 through 08 (all preceding documents)          |

---

## Table of Contents

1. Welcome
2. Day-One Checklist
3. The 30/60/90 Plan
4. System at a Glance
5. Document Map — What to Read When
6. Repository Tour
7. Local Development Setup
8. Your First Pull Request
9. The Mental Models You Need
10. How We Make Decisions
11. How We Work Together
12. Common Tasks Walkthrough
13. Where Things Live (Cheat Sheets)
14. Glossary of Project-Specific Terms
15. Troubleshooting & FAQ
16. People & Channels
17. Appendices

---

## 1. Welcome

Welcome to the CMS team. This guide gets you from "I just joined" to "I shipped my first production change" in **two weeks**, and to "I can lead a feature" in **two months**.

### 1.1 What You're Joining

You're joining a small engineering team building a **headless Content Management System** for internal and external content publishing. The MVP is a deliberately simple system — single VM, Docker Compose, Postgres, Redis — built on rigorous engineering practices (TDD, 98% coverage, Hexagonal backend, Reactive frontend).

The system is small, but the discipline is real. You'll write fewer lines of code than at most jobs, but every line will be tested, reviewed, and operationally sound.

### 1.2 What We Expect From You in Your First Two Weeks

| Expectation                                                            |
| ---------------------------------------------------------------------- |
| Read this guide.                                                       |
| Get your local environment running.                                    |
| Pair with a teammate at least 3 times.                                 |
| Open at least 3 small PRs (docs, tests, tiny fixes are fine).          |
| Attend every standup, review, and retro.                               |
| Ask many questions. There are no "dumb" ones in the first month.      |
| Tell us what's confusing — your fresh eyes are useful.                 |

### 1.3 What We Don't Expect

| Not expected                                                           |
| ---------------------------------------------------------------------- |
| Knowing the codebase end-to-end.                                       |
| Shipping a major feature in the first week.                            |
| Working long hours to "prove yourself."                                |
| Knowing every tool we use. We'll teach you.                            |

---

## 2. Day-One Checklist

Print this. Tick boxes as you go.

### 2.1 Accounts & Access

- [ ] Email account (created by IT)
- [ ] GitHub access to the organization
- [ ] Added to the `cms-team` GitHub team
- [ ] Slack workspace access; joined `#cms-dev`, `#cms-ops`, `#cms-general`
- [ ] Issue tracker (Jira/Linear/GitHub Projects) — added to the CMS project
- [ ] Documentation site access (Confluence / Notion / wherever)
- [ ] Cloud console read access (staging only; production by request)
- [ ] Sentry account
- [ ] Grafana dashboard access
- [ ] VPN or bastion credentials if applicable
- [ ] 1Password / vault access for shared secrets

### 2.2 Tools Installed

- [ ] Git ≥ 2.40
- [ ] Node.js 20 LTS (via `nvm` or `fnm`)
- [ ] pnpm (latest)
- [ ] Docker Engine + Docker Compose v2
- [ ] PostgreSQL client (`psql`)
- [ ] Redis CLI
- [ ] `gh` (GitHub CLI)
- [ ] VS Code (recommended) or your editor of choice
- [ ] Recommended VS Code extensions (see §7.4)
- [ ] GPG or SSH key set up for signed commits

### 2.3 Repos Cloned

- [ ] `cms-api` (backend)
- [ ] `cms-web` (frontend)
- [ ] `cms-infra` (deployment & operations)
- [ ] `cms-docs` (this guide and the 8 other docs)

### 2.4 First-Day Meetings

- [ ] 1:1 with your manager (intro, expectations)
- [ ] 1:1 with Tech Lead (architecture walkthrough)
- [ ] 1:1 with at least one peer (codebase tour)
- [ ] Attend daily standup (lurk first, contribute when comfortable)

### 2.5 First-Day Reads (≤ 90 minutes)

- [ ] This onboarding guide (you're doing it!)
- [ ] **01-Requirements-Specification.md** — what we're building
- [ ] **04-ARCH.md §1–§3** — architectural overview
- [ ] **08-GIT-WORKFLOW.md §1–§3** — how we use Git

You don't need to read everything on day one. The full reading order is in §5.

---

## 3. The 30/60/90 Plan

A rough but useful framing for your first three months.

### 3.1 First 30 Days — Orient

**Goal**: be productive on bounded tasks; understand the lay of the land.

| Week | What you do                                                    |
| ---- | -------------------------------------------------------------- |
| 1    | Setup, reads, lurking in standups, pair on small tasks         |
| 2    | First PRs: docs fixes, simple tests, small bug fixes           |
| 3    | Take a small feature ticket end-to-end with heavy pairing      |
| 4    | Independent on small features; start participating in reviews  |

Milestones by end of day 30:

- 5+ merged PRs.
- Have shipped at least one user-visible change to production.
- Have reviewed at least 3 other people's PRs.
- Have written one ADR or one runbook (even small).
- Can explain the hexagonal architecture in your own words.

### 3.2 Days 31–60 — Contribute

**Goal**: take ownership of features; review others' work substantively.

- Lead at least one feature end-to-end (design → ship).
- Become the go-to person for one module (auth, content, media, etc.).
- Contribute to incident response (on-call shadowing).
- Improve one piece of tooling or documentation.

### 3.3 Days 61–90 — Lead

**Goal**: be a fully participating member; mentor the next new hire.

- Propose and drive one architectural improvement (with ADR).
- Be primary on-call for a week.
- Onboard the next new joiner using this guide.
- Identify and fix one team-level inefficiency.

### 3.4 Beyond 90 Days

You're now a regular team member. You participate in roadmap discussions, lead releases, and represent the team in cross-team conversations.

---

## 4. System at a Glance

### 4.1 What the CMS Does (One Paragraph)

The CMS lets internal users (Admins, Editors, Authors) create and publish content through a web admin panel. Published content is exposed to external frontends through a REST API. The system supports a draft → review → publish workflow, scheduled publishing, media library, role-based access, and audit logging. It is designed to be extensible to multi-language, multi-site, and additional content types in later phases.

### 4.2 High-Level Architecture (90-second version)

```
   Admin Users ──► Admin SPA (React, MD3) ──► Admin API ──┐
                                                            │
   Public Frontends ──► Public API ──────────────────────► │
                                                            ▼
                                                    ┌──────────────┐
                                                    │ Hexagonal BE │
                                                    │ (NestJS)     │
                                                    └──┬──────┬────┘
                                                       │      │
                                              ┌────────▼─┐  ┌─▼──────┐
                                              │ Postgres │  │ Redis  │
                                              └──────────┘  └────────┘
                                                              │
                                                       ┌──────▼──────┐
                                                       │  S3/MinIO   │
                                                       └─────────────┘
```

Everything runs as Docker containers on a single Linux VM. Deployments are managed via Docker Compose with `.env` files. See **07-OPS-ARCH.md**.

### 4.3 The Stack

| Layer       | Tech                                                                 |
| ----------- | -------------------------------------------------------------------- |
| Frontend    | React 18 + TypeScript, MUI v6 (Material Design 3), TanStack Query, Zustand, RxJS, TipTap, Vite |
| Backend     | Node.js 20, NestJS, TypeScript, Prisma, Zod, Pino                    |
| Database    | PostgreSQL 15                                                        |
| Cache/Queue | Redis 7 (BullMQ)                                                     |
| Storage     | S3 / MinIO                                                           |
| Testing     | Vitest, Playwright, Stryker, Testcontainers, MSW                     |
| Ops         | Docker Engine, Docker Compose, nginx, Let's Encrypt                  |
| CI/CD       | GitHub Actions                                                       |
| Observability | OpenTelemetry, Pino, Sentry, Prometheus + Grafana                  |

### 4.4 The Practices

- **Test-Driven Development** (red → green → refactor).
- **98% line/branch coverage**, 100% on critical paths.
- **Mutation testing** ≥ 80%.
- **Hexagonal architecture** on the backend; ports & adapters strictly enforced.
- **Reactive architecture** on the frontend; unidirectional data flow, immutable state.
- **Trunk-Based Development** with short-lived branches.
- **Conventional Commits** + signed commits.
- **Interest-Based Relational** conflict resolution.

---

## 5. Document Map — What to Read When

We have **8 core documents** numbered `01` through `08`. They're meant to be read in order, but you can dip in as needs arise.

| #  | Document                                  | Read by Day | Purpose                                                        |
| -- | ----------------------------------------- | ----------- | -------------------------------------------------------------- |
| 01 | Requirements Specification                | 1           | What we're building and for whom                               |
| 02 | Software Requirements Specification (SRS) | 3           | Functional and non-functional requirements; the "contract"     |
| 03 | DESIGN (UI/UX, Material Design 3)         | 5           | How the admin SPA looks and feels                              |
| 04 | ARCH (Hexagonal BE + Reactive FE)         | 2           | How the code is organized; **most important early read**       |
| 05 | METRICS (TDD, coverage, quality gates)    | 4           | What "done" means; CI gates you must pass                      |
| 06 | TEST-STRATEGY                             | 5           | How we test at every level                                     |
| 07 | OPS-ARCH (single VM, Docker Compose)      | 7           | How the system runs in production                              |
| 08 | GIT-WORKFLOW (Flow + TBD + IBR)           | 2           | How we commit, review, merge, and handle disagreements         |

### 5.1 Suggested Reading Order (Faster Path)

If you want the absolute minimum to start contributing:

```
Day 1:  This guide + 01 + 04 §1–§3 + 08 §1–§7
Day 2:  04 (full) + 08 (full)
Day 3:  05 + 02 sections relevant to your first ticket
Day 4:  06 + 03 (skim if you're backend; deep if frontend)
Day 5+: 07 when your first PR is in staging
```

### 5.2 Suggested Reading Order (Thorough Path)

If you have the luxury of a calm onboarding:

```
01 → 02 → 04 → 05 → 06 → 03 → 07 → 08
```

This follows the natural arc: **what** → **specs** → **architecture** → **quality bar** → **how to test** → **how it looks** → **how it runs** → **how we work**.

### 5.3 Living Documents

These documents are updated when reality changes. If you find something that contradicts the code, **the code is reality** but **the doc is the intent** — bring up the discrepancy.

---

## 6. Repository Tour

### 6.1 Repository Layout

```
cms/                          (umbrella; could be a monorepo or multiple repos)
├── cms-api/                  Backend (Hexagonal)
├── cms-web/                  Frontend (Reactive)
├── cms-infra/                Docker Compose, scripts, runbooks
└── cms-docs/                 The 8 documents + this guide
```

If you're on a monorepo, all of the above are subdirectories. If multi-repo, they're separate.

### 6.2 Backend (`cms-api/`)

```
cms-api/
├── src/
│   ├── modules/
│   │   ├── auth/             ← Each module is a hexagon
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   └── adapters/
│   │   ├── users/
│   │   ├── content/
│   │   ├── media/
│   │   ├── audit/
│   │   ├── public-api/
│   │   └── notifications/
│   ├── shared/               ← Cross-module utilities
│   ├── config/               ← Env validation
│   ├── composition/          ← DI wiring (the "composition root")
│   └── main.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── test/
│   ├── fakes/                ← In-memory port fakes
│   ├── builders/             ← Test data builders
│   ├── integration/
│   └── e2e/
├── Dockerfile
├── package.json
└── tsconfig.json
```

The shape is intentional: every module owns its own `domain/`, `application/`, and `adapters/`. See **04-ARCH.md §4** for full details.

### 6.3 Frontend (`cms-web/`)

```
cms-web/
├── src/
│   ├── app/
│   │   ├── routes/
│   │   ├── providers/
│   │   └── layouts/
│   ├── features/             ← Vertical slices
│   │   ├── auth/
│   │   ├── content/
│   │   ├── media/
│   │   └── ...
│   ├── design-system/        ← MD3 primitives & tokens
│   ├── shared/
│   └── main.tsx
├── test/
│   ├── mocks/                ← MSW handlers
│   ├── builders/
│   ├── utils/
│   └── e2e/
├── public/
├── Dockerfile
├── package.json
└── vite.config.ts
```

Each feature module contains its own pages, components, hooks, api, streams, and types — see **04-ARCH.md §5**.

### 6.4 Infrastructure (`cms-infra/`)

```
cms-infra/
├── docker-compose.yml
├── docker-compose.prod.yml
├── docker-compose.staging.yml
├── .env.example              ← Canonical env schema (NEVER commit .env)
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
├── scripts/
│   ├── deploy.sh
│   ├── backup.sh
│   ├── restore.sh
│   └── ...
├── runbooks/                 ← Operational runbooks
│   ├── api-down.md
│   ├── database-down.md
│   └── ...
└── host-bootstrap.sh
```

See **07-OPS-ARCH.md** for everything ops-related.

### 6.5 Documentation (`cms-docs/`)

```
cms-docs/
├── 01-Requirements-Specification.md
├── 02-Software-Requirements-Specification.md
├── 03-DESIGN.md
├── 04-ARCH.md
├── 05-METRICS.md
├── 06-TEST-STRATEGY.md
├── 07-OPS-ARCH.md
├── 08-GIT-WORKFLOW.md
├── ONBOARDING.md             ← You are here
├── adr/                      ← Architecture Decision Records
│   ├── 0001-hexagonal-backend.md
│   ├── 0002-reactive-frontend.md
│   └── ...
└── waivers/                  ← Quality gate waivers (rare)
```

---

## 7. Local Development Setup

This section gets you from `git clone` to `localhost:3000` running locally.

### 7.1 System Prerequisites

| Tool          | Version           | Install                              |
| ------------- | ----------------- | ------------------------------------ |
| Node.js       | 20 LTS            | `nvm install 20 && nvm use 20`       |
| pnpm          | latest            | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker Engine | 27+               | https://docs.docker.com/engine/install/ |
| Docker Compose | v2.29+           | bundled with Docker Desktop or `docker-compose-plugin` |
| Git           | 2.40+             | https://git-scm.com                  |
| `gh` CLI      | latest            | https://cli.github.com               |
| PostgreSQL client | 15+           | OS-specific; you'll mostly use it through Docker |
| GPG or SSH    | for signing       | https://docs.github.com/en/authentication/managing-commit-signature-verification |

### 7.2 Clone the Repos

```bash
mkdir -p ~/work/cms && cd ~/work/cms
gh repo clone <org>/cms-api
gh repo clone <org>/cms-web
gh repo clone <org>/cms-infra
gh repo clone <org>/cms-docs
```

### 7.3 Configure Git

```bash
cd cms-api  # or any repo
git config user.name "Your Name"
git config user.email "you@example.com"
git config commit.gpgsign true
git config user.signingkey <YOUR_GPG_OR_SSH_KEY>
git config pull.rebase true
```

Or use a global config (recommended) — see **08-GIT-WORKFLOW.md §19.2** for the recommended `.gitconfig`.

### 7.4 Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript (built-in is fine)
- Prisma
- GitLens
- Playwright Test for VSCode
- Vitest
- EditorConfig
- Docker
- REST Client (for poking at the API)

A `.vscode/extensions.json` in each repo lists recommended extensions. VS Code prompts you to install them.

### 7.5 Start the Backend

```bash
cd cms-api

# 1. Install
pnpm install

# 2. Copy env file
cp .env.example .env
# Edit .env with placeholder values — see comments in the file.
# For local dev, the defaults work for most variables.

# 3. Start dependencies (Postgres, Redis, MinIO) via Docker
docker compose -f docker-compose.dev.yml up -d

# 4. Run migrations
pnpm prisma migrate dev

# 5. Seed (optional)
pnpm prisma db seed

# 6. Run the app
pnpm dev
```

The API is now at `http://localhost:3000`.

Verify:

```bash
curl http://localhost:3000/healthz
# → {"status":"ok"}
```

### 7.6 Start the Frontend

In a new terminal:

```bash
cd cms-web
pnpm install
cp .env.example .env.local    # frontend-specific env
pnpm dev
```

The admin SPA is at `http://localhost:5173`.

Log in with the seeded admin account (defaults are in the seed file; commonly `admin@example.com` / `dev-password-123`).

### 7.7 Run Tests

```bash
cd cms-api
pnpm test               # unit + integration
pnpm test:unit          # unit only (fastest)
pnpm test:integration   # integration only
pnpm test:cov           # with coverage
pnpm test:mutation      # mutation testing (slower)

# Frontend
cd cms-web
pnpm test               # unit + component
pnpm test:e2e           # Playwright (requires backend running)
```

### 7.8 Inspecting the Database

```bash
# Via Docker
docker exec -it cms-postgres psql -U cms -d cms

# Or use Prisma Studio
cd cms-api
pnpm prisma studio   # opens at http://localhost:5555
```

### 7.9 Common Local Issues

| Problem                                          | Fix                                                         |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `EADDRINUSE: port 3000 / 5173 / 5432 already in use` | Kill the conflicting process or change port in `.env`   |
| `Prisma client not generated`                    | `pnpm prisma generate`                                      |
| `Migration failed`                                | `pnpm prisma migrate reset` (destroys local data — that's fine for dev) |
| `Cannot connect to Docker daemon`                | Start Docker Desktop / `sudo systemctl start docker`        |
| `Permission denied` on Docker socket             | Add yourself to docker group: `sudo usermod -aG docker $USER` then log out/in |
| Tests pass locally, fail in CI                   | Probably timezone/locale: ensure `TZ=UTC` in your env       |
| MinIO healthcheck failing                        | Wait 10 s; MinIO is slow to start                           |

---

## 8. Your First Pull Request

A guided walkthrough. Pick a small task — your manager or Tech Lead will help find one.

### 8.1 Pick a Starter Task

Look for issues labeled:

- `good-first-issue`
- `docs`
- `tests-needed`
- `chore`

Examples:

- Add a missing test case (e.g., a boundary value).
- Fix a typo in a doc.
- Add a JSDoc comment to an undocumented function.
- Add a missing audit log assertion to an existing test.

**Avoid for your first PR**: anything that crosses module boundaries, schema migrations, or security-sensitive changes.

### 8.2 The Workflow (Step-by-Step)

```bash
# 1. Get the latest main
git checkout main
git pull --rebase

# 2. Branch
git checkout -b feature/<scope>-<short>
# e.g., feature/docs-fix-typo-in-arch

# 3. TDD if it involves code
#    a) Write a failing test that describes the new behavior
#    b) Commit: "red: ..."
#    c) Make it pass with minimal code
#    d) Commit: "green: ..."
#    e) Refactor if useful
#    f) Commit: "refactor: ..."

# 4. Run quality gates locally before pushing
pnpm lint
pnpm typecheck
pnpm test
pnpm test:cov  # check coverage isn't dropping

# 5. Push
git push -u origin feature/<scope>-<short>

# 6. Open a PR
gh pr create --fill
# Or via the GitHub web UI

# 7. Address review comments
#    Add commits to your branch (don't amend)
#    Re-request review when ready

# 8. When approved + green: squash and merge
#    Click the button in GitHub.
#    Watch CI on main.
#    Delete the branch.
```

### 8.3 What to Do When You Get Review Comments

See **08-GIT-WORKFLOW.md §9** for full guidance.

Quick version:

- `must:` comments are blocking — address them.
- `should:` comments are strong recommendations — usually address them; if you disagree, explain why.
- `nit:` comments are minor — you can ignore, but acknowledging is polite.
- `question:` comments are requests for clarity — answer them.
- `praise:` comments — say thanks, move on.

If you disagree with a comment, use the IBR approach (**08 §13**):

1. State your interest.
2. Ask theirs.
3. Reflect what you heard.
4. Explore options.
5. Land on something.

### 8.4 After Your First Merge

- Celebrate quietly. You shipped something.
- Watch main CI to confirm it's green post-merge.
- Watch staging to confirm smoke tests pass.
- Update your tracking ticket.
- Take a moment to read the merged diff again — what would you change next time?

---

## 9. The Mental Models You Need

Before you can navigate the codebase intuitively, you need a few mental models. Internalize these and the architecture will feel obvious.

### 9.1 Hexagonal Architecture (Backend)

> "The domain knows nothing about the outside world. Everything outside is an adapter behind a port."

```
   Driving Adapters (HTTP, Cron, CLI)
              ▼
        Inbound Ports (Use Cases)
              ▼
   ┌──────────────────────────────┐
   │   APPLICATION CORE            │
   │   ┌───────────────────────┐  │
   │   │   DOMAIN              │  │  ← Pure: entities, value objects, services
   │   │   - Entities          │  │
   │   │   - Value Objects     │  │
   │   │   - Domain Services   │  │
   │   │   - Domain Events     │  │
   │   └───────────────────────┘  │
   │   ┌───────────────────────┐  │
   │   │   APPLICATION          │  │  ← Use cases orchestrate
   │   │   - Use Cases          │  │
   │   └───────────────────────┘  │
   └──────────────────────────────┘
              ▼
        Outbound Ports (Interfaces)
              ▼
   Driven Adapters (Postgres, S3, SES, ...)
```

**Practical implications**:

- When you write a new feature, you start in `domain/` (the entity), not in the controller.
- Your domain code never imports Prisma, AWS SDK, Express, or any framework.
- Your use case takes ports as dependencies, not concrete classes.
- Want to swap Postgres for DynamoDB? Write a new outbound adapter; domain unchanged.

The architecture rule is enforced by `dependency-cruiser` in CI (**05-METRICS §4**). Violations fail the PR.

### 9.2 Reactive Architecture (Frontend)

> "Events flow one way. State is immutable. Side effects live at the edges."

```
   User action → dispatch → reducer → new state → re-render
                                          ▲
                              Server response (via TanStack Query cache)
                                          ▲
                              RxJS streams (autosave, uploads, connectivity)
```

**Practical implications**:

- Components don't call `fetch` or `localStorage` directly.
- Presentational components take props only — no `useQuery`, no Zustand reads.
- State changes happen via dispatched actions; reducers are pure.
- Background concerns (autosave, idle session) live as RxJS streams, not as `useEffect` soup.

Architecture rules enforced by `eslint-plugin-boundaries` and custom lint rules (**05-METRICS §5**).

### 9.3 The Quality Gate Pyramid

> "Static checks first, then fast tests, then slow tests."

```
   Static (TypeScript, ESLint, Prettier, deps-cruiser)   ← Fastest, catches most issues
              ▼
   Unit tests (Vitest, no I/O)                            ← < 60 s total
              ▼
   Integration tests (with Testcontainers)                ← < 5 min total
              ▼
   E2E (Playwright)                                       ← < 15 min total
              ▼
   Mutation testing                                        ← Slow; gates PR on changed files only
```

Every gate must pass. There is no "skip tests" or "merge anyway."

### 9.4 Trunk-Based Development with Discipline

> "Main is always releasable. Branches are short. Tests come first."

- You branch from `main`, work for ≤ 2 days, merge back.
- You sync from `main` daily.
- You commit small.
- You write the test first.
- You don't break main; if you do, you revert immediately.

This works because the quality gates (above) catch problems before they land.

### 9.5 Interest-Based Conflict Resolution

> "Critique the code, not the person. State your interest, ask for theirs."

When you disagree in a review or design discussion:

1. Reaffirm the relationship.
2. State facts you both agree on.
3. State YOUR interest (what you need, why).
4. Ask THEIR interest.
5. Reflect what you heard.
6. Explore options together.
7. Pick and document.

See **08-GIT-WORKFLOW.md §13** for the full framework and worked examples.

---

## 10. How We Make Decisions

### 10.1 Decision Authority Map

| Decision type                                        | Who decides                          |
| ---------------------------------------------------- | ------------------------------------ |
| Code-level design within a module                    | PR author + reviewer                 |
| Cross-module architecture                             | Tech Lead (after team discussion)    |
| Architecture rule changes (in 04-ARCH)               | Tech Lead via ADR                    |
| Quality gate threshold changes (in 05-METRICS)       | Tech Lead via ADR                    |
| Process changes (in 08-GIT-WORKFLOW)                 | Tech Lead with team input            |
| Priority / scope                                     | Product Owner                        |
| Release timing                                       | Tech Lead + PO                       |
| Hotfix go/no-go                                      | Tech Lead (or on-call if TL absent)  |
| Quality gate waivers                                 | Tech Lead                            |

### 10.2 ADRs (Architecture Decision Records)

When we make a significant decision, we write it down as a short ADR in `cms-docs/adr/NNNN-title.md`.

ADR template:

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
- Trade-offs

## Alternatives Considered
What else we looked at, and why we rejected them.
```

You'll write at least one ADR in your first 60 days. Don't be intimidated — they're short.

### 10.3 "Disagree and Commit"

After a decision is made, even if you disagreed, you execute fully. You can revisit the decision later with new evidence, but you don't sandbag the current direction.

This is what makes a small team move fast.

---

## 11. How We Work Together

### 11.1 Daily Rhythms

| Ritual                       | When             | Length     |
| ---------------------------- | ---------------- | ---------- |
| Async standup (Slack)        | Morning          | 5 min      |
| PR review responsiveness     | Throughout day   | ≤ 4 hr first response |
| Team sync                    | Monday           | 30 min     |
| Quality review               | Monday           | 15 min     |
| Retro                        | Friday           | 30 min     |

### 11.2 Pairing

We pair often, especially in your first month. Pairing modes we use:

- **Driver-navigator**: one types, one guides; switch every 25 min.
- **Ping-pong TDD**: A writes a failing test, B makes it pass + writes the next failing test, A makes it pass.
- **Mob review**: 3+ people review a tricky PR together on a call.

Ask for a pair. Nobody will refuse.

### 11.3 Asking for Help

Norm: ask for help **after 30 minutes of being stuck**. Not 5 minutes (you'll never learn to push through small things), not 3 hours (you're wasting time).

Where to ask:

| Question type                          | Channel                                |
| -------------------------------------- | -------------------------------------- |
| "How do I run X locally?"              | `#cms-dev`                             |
| "Is this PR approach reasonable?"      | PR description or `#cms-dev`           |
| "I think there's a bug in production"  | `#cms-ops`                             |
| "Help me understand this architecture" | DM your Tech Lead, or `#cms-dev`       |
| "I disagree with a review comment"     | The PR itself; use IBR                 |
| "I'm stuck on a personal thing"        | DM your manager                        |

### 11.4 Communication Norms

- **Write more than you think you need to.** Async work fails on too-terse messages.
- **Reply or acknowledge within a day.** Even "I'll get to this tomorrow" is OK.
- **Use threads in Slack.** Don't pollute main channels.
- **Prefer public over DM** unless it's sensitive. Searchable knowledge.
- **Default to charitable interpretation.** Text amplifies tone.
- **Emoji thoughtfully.** A 👍 saves a reply; a 🙏 softens a critique.

### 11.5 On-Call

You'll start shadowing on-call around day 30. The full rotation hits around day 60.

- See **07-OPS-ARCH.md §18** for runbooks.
- Page on-call only for P1/P2 (per severity definitions there).
- Document every incident in the runbook directory.

---

## 12. Common Tasks Walkthrough

Concrete recipes for common situations.

### 12.1 Add a New Endpoint

Suppose you're adding `GET /api/admin/content/:id/versions`.

1. **Domain**: Is there new logic? In this case, no — versions already exist. Skip.
2. **Application**: New use case `ListContentVersions`. Define inbound port + use case in `modules/content/application/`.
3. **Test the use case**: Write `list-content-versions.use-case.spec.ts` with in-memory fakes. TDD: red → green.
4. **Outbound port**: Likely already exists on `ContentRepository`. If not, add `findVersions(contentId)`.
5. **Adapter (DB)**: Implement `findVersions` in `prisma-content.repository.ts`. Add integration test.
6. **Adapter (HTTP)**: Add route to `content.controller.ts`. Add DTO. Add controller integration test.
7. **OpenAPI**: Regenerated automatically from controller decorators.
8. **Frontend**: Add API call, hook, page. (Separate PR usually.)
9. **E2E**: If a primary user flow, add an E2E test.

PR title: `feat(content): add list versions endpoint`.

### 12.2 Add a New Use Case (Backend)

1. Define **inbound port** interface in `application/ports/in/`.
2. Define **command** and **result** DTOs.
3. Write the **use case test** with in-memory fakes. Cover: happy path, authorization, validation, error cases.
4. Implement the use case in `application/use-cases/`.
5. Wire it up in the composition root (`composition/modules/content.module.ts`).
6. Expose via an adapter (HTTP controller, cron, or queue).
7. Test the adapter (integration test).

### 12.3 Add a New Component (Frontend)

1. Decide: presentational or container?
2. Place it: `features/<feature>/components/` (feature-specific) or `design-system/components/` (cross-feature).
3. Write the **component spec** first (TDD). Cover render, interaction, accessibility.
4. Implement the component.
5. Add a Storybook story if it's a design system component.
6. Use it in the relevant page.
7. If async behavior is involved, add MSW handlers and a hook test.

### 12.4 Add a New Database Migration

Schema changes are sensitive — coordinate with Tech Lead.

1. Edit `prisma/schema.prisma`.
2. Generate migration:
   ```bash
   pnpm prisma migrate dev --name <descriptive_name>
   ```
3. Review the generated SQL. Apply the **expand/contract** pattern for any destructive change (see **07-OPS-ARCH.md §12.3**).
4. Update repository code if column shape changed.
5. Update or add integration tests.
6. Verify migration is forward-compatible with the previous app version (so rollback works).

### 12.5 Add a New Environment Variable

1. Add the variable to `cms-infra/.env.example` with documentation.
2. Add validation in `src/config/env.schema.ts` (Zod).
3. Use it via the typed `env` object in code.
4. Note in PR description that ops need to set the value on staging/production.
5. Update the ops `.env` in coordination with DevOps.

See **07-OPS-ARCH.md §7** for the full SCM policy.

### 12.6 Fix a Bug

TDD-style:

1. **Reproduce** the bug locally.
2. **Write a failing test** that demonstrates the bug. (This is the most important step.) Commit: `red: regression test for <bug>`.
3. **Fix** the code minimally. Commit: `fix: <description>`.
4. Verify the test now passes and no others broke.
5. PR with title `fix(<scope>): <short description>`. Link the bug report.

If the bug is a production hotfix, follow **08-GIT-WORKFLOW.md §12** instead.

### 12.7 Roll Back a Deploy

If you broke production:

1. Stay calm. We've designed for this.
2. SSH to the VM or trigger the rollback pipeline.
3. Run `./scripts/rollback.sh <previous-version>`. See **07-OPS-ARCH.md §11.3**.
4. Confirm smoke tests pass.
5. Notify the team in `#cms-ops`.
6. Open a post-mortem ticket. Schedule a blameless retro.

### 12.8 Respond to a Page

You're on call; PagerDuty wakes you up.

1. Acknowledge within 5 minutes.
2. Look at the alert message; identify the runbook.
3. Open the runbook (e.g., `runbooks/api-down.md`).
4. Follow Detection → Immediate actions.
5. If you can't resolve in 30 minutes, escalate to Tech Lead.
6. Document what you did in the incident log.
7. Post-mortem if S1/S2 (within 48 hours).

---

## 13. Where Things Live (Cheat Sheets)

### 13.1 "I want to..."

| Goal                                          | Look at                                  |
| --------------------------------------------- | ---------------------------------------- |
| Understand what we're building                 | 01-Requirements                          |
| Find the spec for endpoint X                   | 02-SRS §5, or OpenAPI at `/docs`         |
| Know what a screen should look like            | 03-DESIGN                                |
| Understand the backend module structure        | 04-ARCH §4                               |
| Understand the frontend module structure       | 04-ARCH §5                               |
| Know the coverage target for this code         | 05-METRICS §3                            |
| Know how to test this layer                    | 06-TEST-STRATEGY §7 (BE) / §8 (FE)       |
| Know how to deploy                             | 07-OPS-ARCH §11                          |
| Know what env var to add                       | 07-OPS-ARCH §7                           |
| Know how to commit                             | 08-GIT-WORKFLOW §7                       |
| Resolve a disagreement                          | 08-GIT-WORKFLOW §13                      |
| Find a runbook                                  | `cms-infra/runbooks/`                    |
| See a past decision                             | `cms-docs/adr/`                          |

### 13.2 "What command do I run to..."

| Goal                                       | Command                                       |
| ------------------------------------------ | --------------------------------------------- |
| Install deps                                | `pnpm install`                                |
| Run the app                                 | `pnpm dev`                                    |
| Run unit tests                              | `pnpm test:unit`                              |
| Run all tests                               | `pnpm test`                                   |
| Run with coverage                           | `pnpm test:cov`                               |
| Run mutation tests                          | `pnpm test:mutation`                          |
| Run E2E                                     | `pnpm test:e2e`                               |
| Lint                                        | `pnpm lint`                                   |
| Format                                      | `pnpm format`                                 |
| Type-check                                  | `pnpm typecheck`                              |
| Run a single test                           | `pnpm test path/to/test.spec.ts`              |
| Apply migrations                            | `pnpm prisma migrate dev`                     |
| Reset local DB                              | `pnpm prisma migrate reset`                   |
| Open Prisma Studio                          | `pnpm prisma studio`                          |
| Generate Prisma client                      | `pnpm prisma generate`                        |
| Open PR                                     | `gh pr create --fill`                         |
| Squash & merge (via UI)                     | GitHub web                                    |
| Sync feature branch                          | `git fetch && git rebase origin/main`         |
| Revert a bad merge                          | `git revert <sha> && git push origin main`    |

### 13.3 "Who do I ask about..."

| Topic                                      | Channel / Person                             |
| ------------------------------------------ | -------------------------------------------- |
| Architecture                               | Tech Lead, `#cms-dev`                        |
| Setup / local dev issues                    | `#cms-dev`                                   |
| Production / on-call                        | `#cms-ops`                                   |
| Requirements clarification                 | Product Owner                                |
| Process / workflow                          | Tech Lead                                    |
| Security                                   | Security Lead (cc Tech Lead)                 |
| Cloud account / VM access                  | DevOps                                       |
| HR / personal                              | Your Manager                                 |

---

## 14. Glossary of Project-Specific Terms

Cross-referenced with each document's glossary.

| Term                          | Meaning                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| Adapter (BE)                  | Concrete implementation of a port (e.g., `PrismaContentRepository`) |
| ADR                           | Architecture Decision Record                                  |
| Article                       | Blog-style content type with author, tags, category           |
| Author (role)                 | User who creates and submits content for review              |
| Builder (test)                | Function that produces a domain object with defaults for testing |
| Composition Root              | Single place where adapters are wired to ports                |
| Critical Path                 | Code path where bugs cause severe harm; must have 100% coverage |
| Domain Event                  | A fact about a state change in the domain, named in past tense |
| Editor (role)                 | User who reviews and publishes content                        |
| Fake                          | Working in-memory implementation of a port, used in tests     |
| Feature flag                  | Toggle wrapping incomplete or risky code                      |
| Hexagonal Architecture        | a.k.a. Ports & Adapters; the BE architecture style            |
| IBR                           | Interest-Based Relational; our conflict resolution framework  |
| In Review                     | Content state where it's been submitted for editor approval   |
| Inbound port                  | Interface describing what the application can do (a use case) |
| Mutation testing              | Inject changes to code; verify tests catch them               |
| Outbound port                 | Interface the application calls (e.g., `ContentRepository`)   |
| Page                          | Static content type (e.g., "About", "Contact")                |
| Port                          | Interface owned by the application core                       |
| Reactive Architecture         | Frontend architecture pattern: unidirectional flow, immutable state, streams |
| Slug                          | URL-safe identifier for content (e.g., `my-first-article`)   |
| TBD                           | Trunk-Based Development                                       |
| TDD                           | Test-Driven Development                                       |
| Use Case                      | Application service implementing one business operation       |
| Vertical slice                | Feature module containing all layers needed for that feature |

For more terms, see the Glossary appendix in each numbered document.

---

## 15. Troubleshooting & FAQ

### 15.1 Setup Issues

**Q: I get `ECONNREFUSED` when running tests.**
A: Postgres or Redis isn't running. Check `docker compose ps`. Restart with `docker compose up -d`.

**Q: My environment validates and fails on startup.**
A: Zod validation strict. Read the error — it tells you which variable is missing/malformed. Check `.env.example` for shape.

**Q: Prisma client errors after `git pull`.**
A: Schema changed; run `pnpm prisma generate` and `pnpm prisma migrate dev`.

**Q: I can't sign commits.**
A: Verify GPG/SSH key is set up: `git config --get user.signingkey`. Test with `git commit --allow-empty -m "test: signing"`.

### 15.2 Code Questions

**Q: Where do I put this logic — domain, application, or adapter?**
A: Heuristic:
- Is it a business rule that exists regardless of how it's invoked? → **domain**.
- Is it orchestrating a flow that uses multiple ports? → **application use case**.
- Is it talking to an external system or framework? → **adapter**.

**Q: Should I write a `mock` or a `fake`?**
A: A **fake**. Mocks (libraries like `jest.mock`) couple tests to implementation. Fakes are simple in-memory classes implementing the same port — they preserve behavior. See **06-TEST-STRATEGY.md §7.3**.

**Q: I want to call another module's repository directly.**
A: Don't. Cross-module communication goes through inbound ports (use cases) or domain events. See **04-ARCH.md §4.8**.

**Q: My PR has 800 lines of changes.**
A: Split it. Likely into: (1) refactor that doesn't change behavior, (2) actual feature, (3) test additions. See **08-GIT-WORKFLOW.md §8.6**.

**Q: Coverage dropped below 98% — but only by 0.2%.**
A: The gate is strict. Add the missing tests. If it's truly unreachable code, propose an exclusion in `coverage.config.ts` and justify in the PR. See **05-METRICS.md §3.4**.

### 15.3 Workflow Questions

**Q: Can I push directly to main?**
A: No. Branch protection prevents it. Always PR.

**Q: Can I force-push?**
A: To your own feature branch, yes (`--force-with-lease`). To `main` or shared branches, never.

**Q: My reviewer wants something I disagree with.**
A: Use IBR (**08-GIT-WORKFLOW.md §13**). State your interest, ask theirs, find a path. If unresolvable, escalate to Tech Lead.

**Q: How long should a PR review take?**
A: First response within 4 hours, full review within 1 business day. If you're stuck on a review, comment with when you'll get to it.

**Q: I keep getting bounced on `should:` and `nit:` comments.**
A: `nit:` you can ignore. `should:` should be addressed or explained. If a reviewer is over-investing in `nit:`s, that's worth a friendly conversation.

### 15.4 Big Picture Questions

**Q: Why hexagonal? It feels like a lot of files for simple things.**
A: It pays off when:
- The team grows (clear boundaries).
- We need to change a dependency (the swap is mechanical).
- We test (the domain is trivial to test in isolation).
For tiny modules it can feel verbose; for medium/large ones it's the cheapest path long-term. See **04-ARCH.md §4.1** for the full rationale.

**Q: Why 98% coverage instead of 100%?**
A: 100% forces tests for trivial code (re-exports, `default:` clauses) that adds noise. 98% leaves room for things the type system already proves. Critical paths are still 100%. See **05-METRICS.md §1.3**.

**Q: Why TDD if our tests would catch bugs anyway?**
A: TDD shapes the code, not just verifies it. Code written test-first tends to have:
- Smaller, more testable units.
- Better named methods.
- Clear boundaries between layers.
Plus, mutation testing reveals that retroactively-added tests often have weaker assertions.

**Q: Why both Git Flow AND Trunk-Based?**
A: TBD covers the 95% case (day-to-day commits land on main). Git Flow gives us a predictable structure for release coordination and hotfixes — the 5% where TBD alone is awkward. See **08-GIT-WORKFLOW.md §6**.

---

## 16. People & Channels

(This section is customized per team; the structure below is a template.)

### 16.1 The Team

| Name             | Role                       | Slack handle      | Time zone        |
| ---------------- | -------------------------- | ----------------- | ---------------- |
| (Tech Lead)      | Tech Lead                  | @tech-lead        | UTC+7            |
| (PO)             | Product Owner              | @po               | UTC+7            |
| (Senior Eng A)   | Senior Backend Engineer    | @backend-a        | UTC+7            |
| (Senior Eng B)   | Senior Frontend Engineer   | @frontend-b       | UTC+7            |
| (DevOps)         | DevOps / Platform          | @devops           | UTC+7            |
| (QA)             | QA Engineer                | @qa               | UTC+7            |
| (You)            | New Engineer               | @you              | UTC+7            |

### 16.2 Channels

| Channel              | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `#cms-dev`           | Development questions, PR discussions         |
| `#cms-ops`           | Production, alerts, incidents                 |
| `#cms-general`       | Non-urgent team chat                          |
| `#cms-releases`      | Release announcements                         |
| `#cms-random`        | Whatever                                      |

### 16.3 Calendars

| Event                | Cadence            |
| -------------------- | ------------------ |
| Daily standup (async)| Every weekday      |
| Team sync             | Monday 09:00      |
| Quality review       | Monday 09:30       |
| Retro                | Friday 16:00       |
| Sprint planning      | Sprint start       |
| Demo                 | Sprint end         |
| On-call handoff       | Monday 09:00      |

---

## 17. Appendices

### 17.1 Appendix A — First-Week Calendar Template

A sample first-week structure to copy and adapt:

```
Monday
  09:00  Team sync (lurk)
  09:30  Quality review (lurk)
  10:00  1:1 with Manager
  11:00  Set up accounts (IT)
  14:00  1:1 with Tech Lead (architecture overview)
  15:00  Read: this guide + 01 + 04 §1–§3 + 08 §1–§3
  
Tuesday
  09:00  Async standup
  10:00  1:1 with Peer (codebase tour)
  11:00  Local setup (cms-api, cms-web)
  14:00  Pair on running tests, exploring code
  16:00  Read: 04 (full)
  
Wednesday
  09:00  Async standup
  10:00  Pair on a "good first issue"
  14:00  Open first PR (Draft is fine)
  16:00  Read: 08 (full)
  
Thursday
  09:00  Async standup
  10:00  Address PR review comments
  14:00  Pair on a second small task
  16:00  Read: 05 + 06 §1–§4
  
Friday
  09:00  Async standup
  10:00  Merge first PR! Confirm CI on main + staging.
  14:00  Retro (participate; share fresh-eyes observations)
  15:00  Read: 02 (skim) + 03 (skim if backend, deep if frontend)
  16:00  Reflection: what's still confusing? Make a list.
```

### 17.2 Appendix B — Reading Comprehension Checklist

After your first week, you should be able to answer "yes" to most of these:

- [ ] I can explain what a "port" and "adapter" are in our architecture.
- [ ] I know where to put a new database query method.
- [ ] I know where to put a new HTTP endpoint.
- [ ] I know where to put a new presentational React component.
- [ ] I can describe the TDD red-green-refactor cycle.
- [ ] I know what "critical path coverage" means and where the list lives.
- [ ] I can identify which workflow (Git Flow or TBD) applies to a given change.
- [ ] I can find any of the 8 docs by topic.
- [ ] I know who to ask about architecture vs. priority vs. ops.
- [ ] I have used IBR in at least one review.

### 17.3 Appendix C — Self-Reflection Prompts (Weekly, First Month)

Spend 15 minutes at the end of each week writing answers to these. Share with your manager in your 1:1.

1. What did I ship this week?
2. What did I learn that I want to remember?
3. What was confusing? Did I get a clear answer? If not, what's still unclear?
4. Where did I get stuck? How did I unstick?
5. Who helped me this week, and how can I thank them?
6. What would I do differently next week?
7. What feedback do I have for the team or the process?

### 17.4 Appendix D — One-Page Summary

Print this and tape it next to your monitor.

```
┌────────────────────────────────────────────────────────────────┐
│  CMS — One-Page Cheat Sheet                                     │
├────────────────────────────────────────────────────────────────┤
│  Stack:    Node + NestJS + Prisma + Postgres + Redis + S3       │
│            React + TypeScript + MUI + TanStack Query + RxJS     │
│                                                                  │
│  Architecture:  Hexagonal (BE) + Reactive (FE)                  │
│  Practices:     TDD, 98% coverage, mutation ≥ 80%               │
│  Branching:     TBD daily + Git Flow for releases/hotfixes      │
│                                                                  │
│  Daily loop:                                                     │
│    1. Sync:    git fetch && git rebase origin/main              │
│    2. Branch:  git checkout -b feature/<scope>-<short>          │
│    3. TDD:     red → green → refactor                           │
│    4. PR:      gh pr create --fill                              │
│    5. Merge:   all gates green + 1 approval                     │
│                                                                  │
│  Disagree?  Use IBR (08 §13):                                   │
│    1. Relationship 2. Facts 3. Your interest 4. Their interest  │
│    5. Reflect 6. Options 7. Pick                                │
│                                                                  │
│  Stuck?  Ask after 30 min, before 3 hours.                      │
│  Lost?   The doc list (this guide §5) is your map.              │
│  Broke main?  Revert first (≤15 min), debug after.              │
└────────────────────────────────────────────────────────────────┘
```

### 17.5 Appendix E — Document Change Log

| Version | Date       | Author | Change                                  |
| ------- | ---------- | ------ | --------------------------------------- |
| 1.0     | 2026-05-11 | —      | Initial onboarding guide                |

---

**End of Document**

Welcome aboard. We're glad you're here.
