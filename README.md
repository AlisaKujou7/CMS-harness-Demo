# CMS MVP

Headless Content Management System with an admin SPA. The specifications live in
[AIAGENT_POC/](AIAGENT_POC/), and decisions that interpret them live in [docs/adr/](docs/adr/).

| Path       | Contents                                                |
| ---------- | ------------------------------------------------------- |
| `cms-api/` | Backend: hexagonal architecture (04-ARCH §4)            |
| `cms-web/` | Admin SPA: reactive architecture (04-ARCH §5)           |
| `tools/`   | Quality gate runner and its self-test (05-METRICS §11)  |
| `docs/`    | ADRs and the [gate status table](docs/quality/gates.md) |

## Requirements

Node 26 LTS, pnpm 12 and Docker. Versions are explained in
[ADR-0011](docs/adr/0011-toolchain-versions.md).

## Commands

| Command               | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `pnpm install`        | Install dependencies                                      |
| `pnpm test`           | Run the unit tests                                        |
| `pnpm test:cov`       | Run the unit tests with coverage thresholds               |
| `pnpm test:mutation`  | Run Stryker mutation testing                              |
| `pnpm gate:fast`      | Run the gate without the slow and network steps           |
| `pnpm gate`           | Run the full G-03 gate                                    |
| `pnpm gate:self-test` | Plant real violations and prove that the gates catch them |

## Run the API locally

```bash
cp cms-api/.env.example cms-api/.env
docker compose -f cms-api/docker-compose.dev.yml up -d --wait
pnpm --filter cms-api exec prisma migrate deploy
pnpm --filter cms-api build
cd cms-api && SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=choose-a-password-1 node --env-file=.env dist/composition/seed-admin.js
node --env-file=.env dist/main.js
```

Run the worker in another terminal, or queued email is not delivered:

```bash
cd cms-api && node --env-file=.env dist/worker.js
```

Set `JWT_SECRET` in `.env` first. It refuses the placeholder.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.
