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

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.
