# OPS-ARCH.md — Operational Software Architecture

## Content Management System (CMS) — MVP

| Field             | Value                                            |
| ----------------- | ------------------------------------------------ |
| Document Type     | Operational Software Architecture                |
| Document Version  | 1.0                                              |
| Status            | Draft                                            |
| Date              | 2026-05-11                                       |
| Classification    | Internal                                         |
| Deployment Target | Single Linux VM                                  |
| Runtime           | Docker Engine                                    |
| Orchestration     | Docker Compose                                   |
| Configuration Mgmt| `.env` files (Software Configuration Management) |
| Companion Docs    | 01-Requirements, 02-SRS, 03-DESIGN, 04-ARCH, 05-METRICS, 06-TEST-STRATEGY |

---

## Table of Contents

1. Introduction
2. Operational Goals & Constraints
3. Target Environment — Single VM
4. Container Topology
5. Network Architecture
6. Storage Architecture
7. Software Configuration Management (`.env`)
8. Secrets Management
9. Docker Compose Specification
10. Image Build & Distribution
11. Deployment Workflow
12. Database Migration Strategy
13. Backup & Restore
14. Logging Architecture
15. Monitoring & Health Checks
16. Security Hardening
17. Capacity Planning & Resource Limits
18. Incident Response & Runbooks
19. Disaster Recovery
20. Maintenance Procedures
21. Risks & Limitations
22. Appendices

---

## 1. Introduction

### 1.1 Purpose

This document specifies the **operational architecture** for deploying the CMS MVP onto a **single Linux VM** running **Docker Engine**, orchestrated via **Docker Compose**, with **`.env` files** as the Software Configuration Management mechanism.

It is the authoritative reference for:

- DevOps engineers provisioning the VM and running deployments.
- Developers who need to understand how their code runs in production.
- On-call engineers handling incidents.
- Security reviewers validating the runtime posture.

### 1.2 Scope

| In Scope                                          | Out of Scope                              |
| ------------------------------------------------- | ----------------------------------------- |
| VM provisioning requirements                      | Cloud account setup                       |
| Docker Engine + Compose configuration             | Kubernetes / orchestrator-based deploys   |
| Container topology and network design             | CDN selection (referenced only)           |
| `.env`-based configuration management             | HashiCorp Vault / cloud secret managers (covered as future evolution) |
| Backup, restore, monitoring, logging              | Long-term archival policy                 |
| Deployment workflow + runbooks                    | Cost optimization analysis                |
| Security hardening                                | Penetration testing (covered in 06-TEST-STRATEGY) |

### 1.3 Audience

| Audience            | Primary Sections          |
| ------------------- | ------------------------- |
| DevOps Engineers    | All                       |
| Backend Developers  | 4, 7, 9, 11, 12, 14, 15   |
| On-Call Engineers   | 14, 15, 18, 19, 20        |
| Security Reviewers  | 7, 8, 16                  |
| Tech Lead           | 2, 11, 18, 19, 21         |

### 1.4 Operational Style

This is a **single-VM deployment**. It is deliberately simple to match MVP scale (≤ 50 admin users, < 10k content items, < 100 GB media, < 200 RPS public). When the system outgrows a single VM, the migration path is described in §21.

---

## 2. Operational Goals & Constraints

### 2.1 Goals

| Goal                     | How addressed                                          |
| ------------------------ | ------------------------------------------------------ |
| Reproducibility          | All config in version control; `.env` template; deterministic image builds |
| Simplicity               | One VM, Docker Compose, no orchestrator                |
| Recoverability           | Hourly DB backups; tested restore procedure            |
| Observability            | Structured logs to host; Prometheus + Grafana on-host  |
| Security                 | Least privilege, no root containers, TLS everywhere, secrets in `.env` with strict file permissions |
| Predictable upgrades     | Versioned images, immutable tags, documented rollback  |
| Low operational cost     | No managed services in MVP; single VM                  |

### 2.2 Operational Constraints

| Constraint                                                                                  |
| ------------------------------------------------------------------------------------------- |
| MVP uptime target: ≥ 99.5% monthly (≈ 3.6 hours downtime/month allowed)                     |
| Single VM = single point of failure; accepted for MVP                                       |
| RPO ≤ 1 hour, RTO ≤ 4 hours                                                                 |
| All configuration loaded at container start; no live reload in MVP                          |
| All secrets stored in `.env` files with 0600 permissions, owned by deploy user              |
| No SSH access to production except via bastion or break-glass procedure                     |
| Production deploys require explicit approval (see 05-METRICS §11.8 G-07)                    |

---

## 3. Target Environment — Single VM

### 3.1 VM Specifications (Production)

| Resource           | Minimum            | Recommended         |
| ------------------ | ------------------ | ------------------- |
| vCPU               | 4                  | 8                   |
| RAM                | 8 GB               | 16 GB               |
| Root disk          | 40 GB SSD          | 80 GB SSD           |
| Data disk (mounted)| 100 GB SSD         | 200 GB SSD          |
| Network            | 1 Gbps             | 1 Gbps              |
| Public IPv4        | 1 static IP        | 1 static IP         |
| OS                 | Ubuntu Server 24.04 LTS | Ubuntu Server 24.04 LTS |
| Cloud provider     | Any (AWS EC2, Azure VM, GCP, DigitalOcean, on-prem) | — |

Staging VM may be 50% sized.

### 3.2 Host OS Requirements

- Ubuntu Server 24.04 LTS (or RHEL 9 / Debian 12 equivalents).
- Kernel ≥ 6.x.
- `systemd` as init system.
- `ufw` (firewall) enabled.
- `unattended-upgrades` enabled for security patches.
- NTP enabled (`systemd-timesyncd` or `chrony`).
- Locale: `en_US.UTF-8`.
- Timezone: `UTC`.
- Swap: 4 GB (or matched to RAM up to 16 GB).

### 3.3 Pre-installed Host Software

| Package                 | Version           | Purpose                            |
| ----------------------- | ----------------- | ---------------------------------- |
| Docker Engine           | 27.x or later     | Container runtime                  |
| Docker Compose plugin   | v2.29+            | Multi-container orchestration      |
| `git`                   | latest            | Pull deployment repo               |
| `curl`, `jq`            | latest            | Operational scripts                |
| `ufw`                   | latest            | Firewall                           |
| `fail2ban`              | latest            | SSH brute-force protection         |
| `awscli` or equiv.      | latest            | Off-VM backup uploads              |
| `restic` or `borgbackup`| latest            | Encrypted backup tool              |
| `node_exporter`         | latest            | Host metrics for Prometheus        |

Software install scripts live in `infra/host-bootstrap.sh`, version-controlled.

### 3.4 Host User Accounts

| User       | Purpose                                  | Shell    | sudo      |
| ---------- | ---------------------------------------- | -------- | --------- |
| `root`     | System-level only, never daily use       | `bash`   | n/a       |
| `deploy`   | Owns app files, runs Docker commands     | `bash`   | docker-only |
| `ansible`  | Ansible automation (if used)             | `bash`   | password-less |

`deploy` is added to the `docker` group. Direct SSH as `root` is disabled in `/etc/ssh/sshd_config`.

### 3.5 Directory Layout on Host

```
/opt/cms/                          ← deploy user owns
├── current/                       ← symlink → releases/<version>
├── releases/
│   ├── 1.0.0/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.prod.yml
│   │   ├── .env                   ← 0600, deploy:deploy
│   │   ├── nginx/
│   │   │   ├── nginx.conf
│   │   │   └── conf.d/
│   │   ├── scripts/
│   │   │   ├── deploy.sh
│   │   │   ├── backup.sh
│   │   │   └── restore.sh
│   │   └── migrations/            ← Prisma migration SQL (read-only)
│   ├── 1.0.1/
│   └── 1.1.0/
└── shared/                        ← persistent across releases
    ├── env/
    │   └── .env.production        ← canonical env file (symlinked from each release)
    └── secrets/                   ← key material, certs

/var/lib/cms/                      ← persistent data (mounted to /data disk)
├── postgres/                      ← Postgres data directory
├── redis/                         ← Redis AOF/RDB
├── minio/                         ← Object storage (if MinIO chosen over external S3)
├── uploads-staging/               ← Pre-finalize media staging
└── backups/
    ├── postgres/
    │   ├── hourly/
    │   └── daily/
    ├── env/
    └── audit/

/var/log/cms/                      ← Application + container logs (or use journald)

/etc/cms/                          ← Read-only system config
└── tls/
    ├── fullchain.pem              ← from Let's Encrypt
    └── privkey.pem                ← 0600, root:root
```

---

## 4. Container Topology

### 4.1 Container Inventory

The CMS runs as **8 containers** on the single VM:

| # | Container       | Image (example)               | Purpose                                  |
| - | --------------- | ----------------------------- | ---------------------------------------- |
| 1 | `nginx`         | `nginx:1.27-alpine`           | TLS termination, reverse proxy, static assets |
| 2 | `cms-api`       | `ghcr.io/org/cms-api:1.0.0`   | NestJS application server (BE)           |
| 3 | `cms-worker`    | `ghcr.io/org/cms-api:1.0.0`   | Background jobs (scheduled publish, image variants) — same image, different command |
| 4 | `cms-web`       | `ghcr.io/org/cms-web:1.0.0`   | Static SPA assets (or served via nginx; see note) |
| 5 | `postgres`      | `postgres:15-alpine`          | Primary database                         |
| 6 | `redis`         | `redis:7-alpine`              | Cache, job queue (BullMQ)                |
| 7 | `minio` *(opt)* | `minio/minio:latest`          | S3-compatible object storage (only if external S3 not used) |
| 8 | `node-exporter` | `prom/node-exporter:latest`   | Host metrics for Prometheus              |

**Note on `cms-web`**: For MVP, the SPA can either:
- (A) Run as its own container serving static files, with nginx proxying.
- (B) Be copied into the nginx container as static assets.

Option (B) is simpler for single-VM MVP and is the **default** in this document. The `cms-web` container in the table above is therefore typically omitted, and nginx serves the SPA directly.

### 4.2 Topology Diagram

```
                                ┌──────────────────┐
                                │   Public Users    │
                                │   + API Clients   │
                                └────────┬─────────┘
                                         │ HTTPS (443)
                                         ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                       Single VM                                 │
   │                                                                  │
   │   ┌──────────────────────────────────────────────────────┐      │
   │   │                  ufw firewall                          │      │
   │   │     allow: 22 (SSH, restricted), 80, 443               │      │
   │   └──────────────────────────────────────────────────────┘      │
   │                                                                  │
   │   ┌──────────────────────────────────────────────────────┐      │
   │   │                   Docker Engine                        │      │
   │   │                                                        │      │
   │   │   ┌────────────────────────────────────────────┐     │      │
   │   │   │  Network: cms-edge  (bridge, exposed)      │     │      │
   │   │   │  ┌───────────┐                              │     │      │
   │   │   │  │   nginx   │  TLS, reverse proxy, SPA     │     │      │
   │   │   │  └─────┬─────┘                              │     │      │
   │   │   └────────┼─────────────────────────────────────┘     │      │
   │   │            │                                            │      │
   │   │   ┌────────┼─────────────────────────────────────┐     │      │
   │   │   │  Network: cms-internal  (bridge, internal)   │     │      │
   │   │   │        │                                      │     │      │
   │   │   │  ┌─────▼──────┐    ┌─────────────┐           │     │      │
   │   │   │  │  cms-api   │    │ cms-worker  │           │     │      │
   │   │   │  │  (NestJS)  │    │ (BullMQ)    │           │     │      │
   │   │   │  └─┬───┬──────┘    └─┬─────┬─────┘           │     │      │
   │   │   │    │   │              │     │                 │     │      │
   │   │   │    │   └────┐    ┌────┘     │                 │     │      │
   │   │   │    │        │    │          │                 │     │      │
   │   │   │  ┌─▼──────┐ ▼    ▼ ┌────────▼─────┐           │     │      │
   │   │   │  │postgres│ ┌────┴┐│    redis     │           │     │      │
   │   │   │  └────────┘ │minio││  (cache +    │           │     │      │
   │   │   │             │(opt)││   queue)     │           │     │      │
   │   │   │             └─────┘└──────────────┘           │     │      │
   │   │   └─────────────────────────────────────────────┘     │      │
   │   │                                                        │      │
   │   │   ┌──────────────────────────────────────────┐         │      │
   │   │   │  Network: cms-monitoring (bridge)         │         │      │
   │   │   │   node-exporter → (scraped by Prometheus  │         │      │
   │   │   │   either on-host or off-host)             │         │      │
   │   │   └──────────────────────────────────────────┘         │      │
   │   │                                                        │      │
   │   └────────────────────────────────────────────────────────┘     │
   │                                                                   │
   │   Volumes (mounted from /var/lib/cms):                            │
   │     /var/lib/cms/postgres → postgres:/var/lib/postgresql/data     │
   │     /var/lib/cms/redis    → redis:/data                           │
   │     /var/lib/cms/minio    → minio:/data (if MinIO used)           │
   │                                                                   │
   └───────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  External (off-VM):  │
                              │  - DNS (Route53 etc) │
                              │  - SMTP (SES)        │
                              │  - Off-site backup   │
                              │    (S3, B2, etc.)    │
                              │  - Sentry (errors)   │
                              │  - Off-host metrics  │
                              │    (optional)        │
                              └──────────────────────┘
```

### 4.3 Container Roles & Dependencies

| Container     | Depends on                  | Start order  | Health check                              |
| ------------- | --------------------------- | ------------ | ----------------------------------------- |
| `postgres`    | —                           | 1            | `pg_isready -U cms`                       |
| `redis`       | —                           | 1            | `redis-cli ping`                          |
| `minio` *(opt)* | —                         | 1            | HTTP `GET /minio/health/live`             |
| `cms-api`     | postgres, redis, minio*     | 2            | HTTP `GET /healthz`                       |
| `cms-worker`  | postgres, redis             | 2            | Process liveness; queue heartbeat         |
| `nginx`       | cms-api                     | 3            | HTTP `GET /healthz` via upstream          |
| `node-exporter`| —                          | 1            | HTTP `GET /metrics`                       |

Compose `depends_on` with `condition: service_healthy` enforces start order.

---

## 5. Network Architecture

### 5.1 Networks

Three Docker networks isolate concerns:

| Network          | Driver | Internal | Purpose                                            |
| ---------------- | ------ | -------- | -------------------------------------------------- |
| `cms-edge`       | bridge | no       | nginx is the only container exposed here; binds to host ports 80/443 |
| `cms-internal`   | bridge | **yes**  | All app + data services. Not reachable from host or outside |
| `cms-monitoring` | bridge | no       | Exporters scraped from outside the VM (if using off-host Prometheus) |

`cms-internal` is marked `internal: true` in Compose, meaning containers on it cannot reach the public internet **except via** an explicitly allowed proxy. This forces all outbound calls (to email service, off-site backup, Sentry) to go through controlled paths.

### 5.2 Outbound Internet Access Strategy

The application server must reach:

- AWS SES (or equivalent) for transactional email
- Sentry for error tracking
- Off-site backup endpoint
- (Optional) Webhook destinations in future

Three options:

| Option                          | Trade-off                                                |
| ------------------------------- | -------------------------------------------------------- |
| (A) Drop `internal: true`        | Simplest; allows direct egress; less defense in depth   |
| (B) Egress proxy container       | Single point to control + audit egress; adds complexity |
| (C) Selectively allow per-service| Complex Compose config                                  |

**MVP default: (A) with `ufw` egress filtering on the host as the control point.** Document each allowed egress destination in `infra/egress-allowlist.md`.

### 5.3 Host Firewall (ufw)

Inbound:

```
ufw default deny incoming
ufw default allow outgoing
ufw allow from <bastion-ip> to any port 22 proto tcp comment 'SSH from bastion only'
ufw allow 80/tcp  comment 'HTTP (redirect to HTTPS)'
ufw allow 443/tcp comment 'HTTPS'
ufw enable
```

SSH is **not** open to the public internet. Either:

- Restricted to a bastion host's static IP, or
- Behind a VPN, or
- Via cloud provider's session manager (AWS SSM, Azure Bastion).

Outbound:

```
# Default: allow all outgoing (Docker NAT needs flexibility)
# Tighten later by allow-listing destination IPs/ports if compliance requires.
```

### 5.4 TLS

- TLS 1.2+ only; TLS 1.3 preferred.
- Certificate from **Let's Encrypt** via `certbot` running on the host (renews automatically).
- Cert files in `/etc/cms/tls/`, mounted read-only into `nginx`.
- HSTS enabled (`max-age=63072000; includeSubDomains; preload`).
- Strong cipher suite per Mozilla's "Intermediate" recommendation.
- OCSP stapling enabled in nginx.

### 5.5 nginx Reverse Proxy Configuration (Excerpt)

```nginx
# /opt/cms/current/nginx/conf.d/cms.conf

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name cms.example.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name cms.example.com;

    ssl_certificate     /etc/cms/tls/fullchain.pem;
    ssl_certificate_key /etc/cms/tls/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:...;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; ..." always;

    client_max_body_size 25M;  # accommodate 20 MB media uploads

    # Admin SPA static files
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://cms-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Health
    location = /healthz {
        proxy_pass http://cms-api:3000/healthz;
        access_log off;
    }
}
```

---

## 6. Storage Architecture

### 6.1 Volume Strategy

| Data                | Path on host                      | Mount in container             | Type        | Backup |
| ------------------- | --------------------------------- | ------------------------------ | ----------- | ------ |
| Postgres data       | `/var/lib/cms/postgres`           | `/var/lib/postgresql/data`     | Bind mount  | Yes    |
| Redis data          | `/var/lib/cms/redis`              | `/data`                        | Bind mount  | Yes (AOF) |
| MinIO data *(opt)*  | `/var/lib/cms/minio`              | `/data`                        | Bind mount  | Yes    |
| Media staging       | `/var/lib/cms/uploads-staging`    | `/app/uploads-staging`         | Bind mount  | No (transient) |
| nginx static SPA    | `/opt/cms/current/web-dist`       | `/usr/share/nginx/html` (RO)   | Bind mount  | Image |
| TLS certs           | `/etc/cms/tls`                    | `/etc/nginx/tls` (RO)          | Bind mount  | Yes    |
| Logs (if file-based)| `/var/log/cms`                    | `/app/logs`                    | Bind mount  | Yes (rotated) |

Bind mounts (instead of named Docker volumes) are used because:

1. Easier to backup (standard filesystem tools).
2. Predictable paths for ops scripts.
3. Direct access for emergency inspection.

### 6.2 Data Disk Layout

Separate data disk mounted at `/var/lib/cms`:

```
/var/lib/cms (mounted, ext4, 200 GB)
├── postgres/      ← ~10-30 GB at MVP scale
├── redis/         ← ~1 GB
├── minio/         ← ~50-100 GB (if used)
├── uploads-staging/  ← ~5 GB (transient)
└── backups/
    ├── postgres/
    │   ├── hourly/   ← 24 retained
    │   └── daily/    ← 30 retained
    └── env/
```

Disk usage monitored; alert at 75%, page at 85%.

### 6.3 File Ownership & Permissions

```
/var/lib/cms                          755 root:root
/var/lib/cms/postgres                 700 999:999    (postgres user inside container)
/var/lib/cms/redis                    700 999:999    (redis user inside container)
/var/lib/cms/minio                    700 1000:1000  (minio user)
/var/lib/cms/uploads-staging          775 1000:1000  (cms-api node user)
/var/lib/cms/backups                  700 deploy:deploy
/etc/cms/tls                          750 root:nginx
/etc/cms/tls/privkey.pem              640 root:nginx
/opt/cms                              755 deploy:deploy
/opt/cms/current/.env                 600 deploy:deploy
```

---

## 7. Software Configuration Management (`.env`)

### 7.1 Principles

1. **Configuration is separate from code.** Twelve-factor principle.
2. **One `.env` per environment.** `.env.production`, `.env.staging`, `.env.dev`.
3. **`.env` files are NEVER committed.** `.gitignore` enforces this. Only `.env.example` is committed.
4. **The committed `.env.example` is the canonical schema.** Every variable used in the app appears there with a documented default or placeholder.
5. **Variables are validated at container start.** The app crashes loudly if a required variable is missing or malformed.
6. **Changes to `.env` require deploy approval.** Same review process as code changes (PR for the `.env.example` schema; out-of-band approval for actual `.env` values).

### 7.2 `.env.example` (Canonical Schema)

```bash
# ============================================================================
# CMS — Environment Configuration
# Copy this file to .env and fill in real values. Do NOT commit .env.
# ============================================================================

# ─── Deployment metadata ────────────────────────────────────────────────────
NODE_ENV=production                          # production | staging | development
APP_VERSION=1.0.0                            # injected at build time
APP_NAME=cms

# ─── Public URLs ────────────────────────────────────────────────────────────
PUBLIC_URL=https://cms.example.com           # base URL of the admin SPA
API_PUBLIC_URL=https://cms.example.com/api   # base URL of the API
CORS_ALLOWED_ORIGINS=https://cms.example.com,https://www.example.com

# ─── HTTP server ────────────────────────────────────────────────────────────
HTTP_PORT=3000                               # internal port of cms-api
HTTP_BODY_LIMIT_MB=25
TRUST_PROXY=true                             # nginx is upstream

# ─── Database (Postgres) ────────────────────────────────────────────────────
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=cms
POSTGRES_PASSWORD=__CHANGE_ME__              # generated; 32+ chars
POSTGRES_DB=cms
POSTGRES_SSL=false                           # in-cluster traffic; true if external DB
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public
DB_POOL_MIN=2
DB_POOL_MAX=10

# ─── Redis ──────────────────────────────────────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=__CHANGE_ME__
REDIS_URL=redis://default:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}

# ─── Object storage (S3 or MinIO) ───────────────────────────────────────────
OBJECT_STORAGE_PROVIDER=minio                # minio | s3
OBJECT_STORAGE_ENDPOINT=http://minio:9000    # internal MinIO endpoint
OBJECT_STORAGE_REGION=us-east-1
OBJECT_STORAGE_BUCKET=cms-media
OBJECT_STORAGE_ACCESS_KEY=__CHANGE_ME__
OBJECT_STORAGE_SECRET_KEY=__CHANGE_ME__
OBJECT_STORAGE_PUBLIC_URL=https://media.cms.example.com   # CDN-backed or direct

# ─── Auth / JWT ─────────────────────────────────────────────────────────────
JWT_SECRET=__CHANGE_ME_64_CHAR_HEX__         # HS256 signing secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=14d
PASSWORD_HASH_ALGO=argon2id
ARGON2_MEMORY_KB=19456
ARGON2_ITERATIONS=2
ARGON2_PARALLELISM=1

# ─── Rate limiting ──────────────────────────────────────────────────────────
RATE_LIMIT_LOGIN_PER_MIN=10
RATE_LIMIT_PASSWORD_RESET_PER_HOUR=5
RATE_LIMIT_PUBLIC_API_PER_MIN=60
RATE_LIMIT_ADMIN_MUTATION_PER_MIN=60

# ─── Email (SES via SMTP, or API) ───────────────────────────────────────────
EMAIL_PROVIDER=ses                           # ses | smtp | console (dev only)
EMAIL_FROM=no-reply@cms.example.com
EMAIL_FROM_NAME=CMS
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=__CHANGE_ME__
SMTP_PASSWORD=__CHANGE_ME__
SMTP_SECURE=true

# ─── Observability ──────────────────────────────────────────────────────────
LOG_LEVEL=info                               # error | warn | info | debug
LOG_FORMAT=json
SENTRY_DSN=
SENTRY_ENV=production
SENTRY_SAMPLE_RATE=1.0
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_SERVICE_NAME=cms-api

# ─── Worker (background jobs) ───────────────────────────────────────────────
WORKER_CONCURRENCY=5
WORKER_SCHEDULED_PUBLISH_INTERVAL_SEC=30

# ─── Feature flags ──────────────────────────────────────────────────────────
FEATURE_MEDIA_VARIANTS_ENABLED=true
FEATURE_SCHEDULED_PUBLISH_ENABLED=true

# ─── Backup ─────────────────────────────────────────────────────────────────
BACKUP_S3_BUCKET=cms-backups-offsite
BACKUP_S3_REGION=us-east-1
BACKUP_S3_ACCESS_KEY=__CHANGE_ME__
BACKUP_S3_SECRET_KEY=__CHANGE_ME__
BACKUP_RETENTION_HOURLY=24
BACKUP_RETENTION_DAILY=30
BACKUP_RETENTION_WEEKLY=12
RESTIC_PASSWORD=__CHANGE_ME__

# ─── MinIO root (only if using MinIO) ───────────────────────────────────────
MINIO_ROOT_USER=__CHANGE_ME__
MINIO_ROOT_PASSWORD=__CHANGE_ME_32_CHARS__
```

### 7.3 Environment Variable Validation

The app starts with a strict validation step (Zod schema). Missing or invalid required variables → process exits with code 1 and a descriptive error.

```typescript
// src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['production', 'staging', 'development']),
  HTTP_PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(64),
  // ... every variable
});

export const env = envSchema.parse(process.env);
```

Validation runs **before** Nest initializes anything else. A misconfigured container fails fast and the orchestrator's restart loop becomes visible immediately.

### 7.4 `.env` File Lifecycle

| Phase           | Who               | Action                                           |
| --------------- | ----------------- | ------------------------------------------------ |
| Schema change   | Developer (PR)    | Update `.env.example`; document in PR            |
| Schema review   | Tech Lead         | Approve PR; new variable communicated to ops     |
| Value provisioning | DevOps (out-of-band) | Generate secret value; update `.env` on host |
| Apply           | DevOps            | Re-run `docker compose up -d` for affected services |
| Audit           | DevOps            | Append change to `infra/CHANGELOG.env.md` (without values) |

### 7.5 Environment File Layering (Compose)

Docker Compose can read multiple env files. Layering enables per-environment overrides:

```
.env                   ← single canonical file in /opt/cms/current/
.env.local             ← optional, overrides for VM-specific (e.g., bind IP)
```

In practice, MVP uses a single `.env` per VM. Layering is reserved for future multi-VM setups.

### 7.6 Forbidden Patterns

- Committing `.env` to git.
- Storing secrets in `docker-compose.yml` directly.
- Echoing secrets in CI logs.
- Sharing `.env` over chat or email — use a secrets manager or encrypted file transfer.
- Modifying `.env` without updating `infra/CHANGELOG.env.md`.

---

## 8. Secrets Management

### 8.1 Approach (MVP)

Secrets live in `/opt/cms/current/.env` with `chmod 600`, owned by `deploy:deploy`. The file is readable only by the `deploy` user. Docker Compose passes it to containers as environment variables. **Containers never see the file itself, only the resolved variables.**

This is acceptable for MVP because:

- Single VM, no network distribution of the file.
- Disk encryption at rest (cloud provider).
- File permissions enforce least privilege at OS level.
- Audit log captures sudo / file-access events.

### 8.2 Secret Categories

| Category                  | Examples                                          |
| ------------------------- | ------------------------------------------------- |
| Database credentials      | `POSTGRES_PASSWORD`                               |
| Auth secrets              | `JWT_SECRET`                                      |
| External service creds    | `SMTP_PASSWORD`, `BACKUP_S3_SECRET_KEY`           |
| Object storage creds      | `OBJECT_STORAGE_SECRET_KEY`                       |
| Encryption keys           | `RESTIC_PASSWORD`                                 |
| Root credentials          | `MINIO_ROOT_PASSWORD`                             |

### 8.3 Secret Generation

All secrets are generated using cryptographically secure random sources:

```bash
# 32-char alphanumeric password
openssl rand -base64 32 | tr -d '/+=' | head -c 32

# 64-char hex (e.g., for JWT_SECRET)
openssl rand -hex 64

# UUID
uuidgen
```

A helper script `infra/scripts/generate-secrets.sh` initializes a new `.env` from `.env.example` with all `__CHANGE_ME__` placeholders replaced.

### 8.4 Secret Rotation Policy

| Secret                    | Rotation cadence        | Procedure                                       |
| ------------------------- | ----------------------- | ----------------------------------------------- |
| `JWT_SECRET`              | Every 90 days OR on incident | Add new secret as fallback verifier for 24h, then promote |
| `POSTGRES_PASSWORD`       | Every 180 days          | Change in DB, update `.env`, rolling restart    |
| `REDIS_PASSWORD`          | Every 180 days          | Same pattern                                    |
| External API credentials  | Per provider policy     | Update `.env`, restart affected services        |
| TLS certificates          | Auto (Let's Encrypt every 60 days) | `certbot renew` cron                  |
| Backup encryption keys    | Annually                | Re-key backups; document key change            |

Rotation is logged in `infra/CHANGELOG.env.md` with date and operator.

### 8.5 Break-Glass Access

If `deploy` user credentials are unavailable, recovery is via:

1. Cloud provider console → reset SSH key for an emergency admin.
2. Read `.env` from the most recent off-site backup.
3. Rotate all secrets immediately after access is restored.

### 8.6 Future Evolution

When the system grows beyond a single VM, secrets management migrates to:

- **HashiCorp Vault** (self-hosted) or
- **AWS Secrets Manager** / **Azure Key Vault** (managed).

The application already reads secrets through a thin abstraction (`config.service.ts`), so the migration is a swap of provider implementation.

---

## 9. Docker Compose Specification

### 9.1 File Layout

Three Compose files compose together:

```
docker-compose.yml          ← base definition (services, networks, volumes)
docker-compose.prod.yml     ← production overrides (resource limits, logging)
docker-compose.staging.yml  ← staging overrides
```

Launched with:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env up -d
```

### 9.2 Base Compose File (`docker-compose.yml`)

```yaml
name: cms

services:
  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on:
      cms-api:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/cms/tls:/etc/cms/tls:ro
      - ./web-dist:/usr/share/nginx/html:ro
      - /var/www/certbot:/var/www/certbot:ro
    networks:
      - cms-edge
      - cms-internal
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  cms-api:
    image: ${CMS_API_IMAGE:-ghcr.io/org/cms-api:1.0.0}
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    env_file: .env
    environment:
      ROLE: api
    networks:
      - cms-internal
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/healthz"]
      interval: 15s
      timeout: 5s
      retries: 4
      start_period: 30s
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true

  cms-worker:
    image: ${CMS_API_IMAGE:-ghcr.io/org/cms-api:1.0.0}
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file: .env
    environment:
      ROLE: worker
    command: ["node", "dist/worker.js"]
    networks:
      - cms-internal
    healthcheck:
      test: ["CMD", "node", "dist/scripts/worker-heartbeat.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - /var/lib/cms/postgres:/var/lib/postgresql/data
    networks:
      - cms-internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    shm_size: 256mb
    security_opt:
      - no-new-privileges:true

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command:
      - redis-server
      - --requirepass
      - ${REDIS_PASSWORD}
      - --appendonly
      - "yes"
      - --maxmemory
      - 1gb
      - --maxmemory-policy
      - allkeys-lru
    volumes:
      - /var/lib/cms/redis:/data
    networks:
      - cms-internal
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    security_opt:
      - no-new-privileges:true

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - /var/lib/cms/minio:/data
    networks:
      - cms-internal
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:9000/minio/health/live"]
      interval: 15s
      timeout: 5s
      retries: 5
    security_opt:
      - no-new-privileges:true

  node-exporter:
    image: prom/node-exporter:latest
    restart: unless-stopped
    pid: host
    network_mode: host
    volumes:
      - /:/host:ro,rslave
    command:
      - --path.rootfs=/host
      - --collector.systemd
      - --no-collector.wifi

networks:
  cms-edge:
    driver: bridge
  cms-internal:
    driver: bridge
    internal: false   # set true and add an egress strategy if compliance requires
```

### 9.3 Production Overrides (`docker-compose.prod.yml`)

```yaml
services:
  cms-api:
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 1g
        reservations:
          cpus: "0.5"
          memory: 512m
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
        labels: "service,environment"
        tag: "{{.Name}}/{{.ID}}"

  cms-worker:
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 768m
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"

  postgres:
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2g
        reservations:
          cpus: "1.0"
          memory: 1g
    command:
      - postgres
      - -c
      - shared_buffers=512MB
      - -c
      - effective_cache_size=1500MB
      - -c
      - work_mem=16MB
      - -c
      - maintenance_work_mem=128MB
      - -c
      - max_connections=100
      - -c
      - log_min_duration_statement=1000
      - -c
      - log_line_prefix='%t [%p] %u@%d '

  redis:
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 1.2g

  minio:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1g

  nginx:
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256m
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
```

### 9.4 Why Not Docker Swarm

For MVP we deliberately avoid Swarm mode:

- One VM → no clustering benefit.
- Compose is simpler to debug.
- Resource limits and restart policies are supported in plain Compose.

When we move to multi-node, we will jump straight to **Kubernetes** rather than Swarm.

---

## 10. Image Build & Distribution

### 10.1 Image Strategy

- **Source of truth**: GitHub container registry (`ghcr.io/<org>/cms-api`, `ghcr.io/<org>/cms-web`).
- **Built in CI** by GitHub Actions on every merge to `main` and on every tagged release.
- **Tags**:
  - `1.0.0` — exact SemVer; immutable.
  - `1.0` — moves to latest patch within minor; used in staging.
  - `latest` — last stable release; NEVER used in production deploys.
  - `sha-<git-sha>` — every CI build; for debugging.
- **Signed** with `cosign` after build.
- **SBOM** generated with `syft` and uploaded alongside.

### 10.2 Dockerfile Standards

| Rule                                                              |
| ----------------------------------------------------------------- |
| Multi-stage build: builder → distroless or minimal runtime image. |
| Runtime image runs as a non-root user (UID ≥ 1000).               |
| `WORKDIR /app`.                                                    |
| Healthcheck embedded.                                              |
| No build tooling in the runtime image (no `npm`, no `git`).        |
| `.dockerignore` excludes `node_modules`, `.env`, tests, docs.      |
| Final image ≤ 300 MB (per 05-METRICS M-INF-03).                    |

### 10.3 Backend Dockerfile (Skeleton)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate && pnpm build

FROM node:20-bookworm-slim AS runtime
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/false --create-home nodejs
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "dist/main.js"]
```

### 10.4 Image Pull on the VM

The deploy user authenticates to GHCR via a long-lived deploy token stored in `/opt/cms/.docker/config.json` (mode 600).

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <user> --password-stdin
```

Token is rotated every 90 days. Tokens have **read-only** scope on the registry.

---

## 11. Deployment Workflow

### 11.1 Deployment Model

**Pattern**: blue/green-lite on a single VM using image tag swaps.

Because we have a single VM, we cannot do true blue/green at the host level. We approximate it through:

1. Pull the new image while the old container is still serving.
2. Run DB migrations (forward-compatible only).
3. Recreate the containers (`docker compose up -d` with the new tag).
4. Compose performs rolling recreate per service.
5. Healthchecks gate readiness.
6. Old container is stopped only after the new one is healthy.

This gives near-zero downtime for stateless services. nginx briefly returns 502 if a request lands during the swap (mitigated by `proxy_next_upstream` and short keepalive).

### 11.2 Deploy Script

`/opt/cms/current/scripts/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?usage: deploy.sh <version>}"
RELEASE_DIR="/opt/cms/releases/${VERSION}"
ENV_FILE="/opt/cms/shared/env/.env.production"

echo "==> Preparing release ${VERSION}"
mkdir -p "${RELEASE_DIR}"
git -C "${RELEASE_DIR}" clone --depth 1 --branch "v${VERSION}" \
    https://github.com/org/cms-infra.git . || \
    git -C "${RELEASE_DIR}" fetch && git -C "${RELEASE_DIR}" checkout "v${VERSION}"

ln -sf "${ENV_FILE}" "${RELEASE_DIR}/.env"

echo "==> Pulling images"
cd "${RELEASE_DIR}"
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

echo "==> Verifying image signatures"
cosign verify --certificate-identity-regexp='.*' \
              --certificate-oidc-issuer='https://token.actions.githubusercontent.com' \
              "ghcr.io/org/cms-api:${VERSION}"

echo "==> Running pre-deploy DB migrations"
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm cms-api \
    node dist/scripts/migrate.js

echo "==> Switching symlink"
ln -sfn "${RELEASE_DIR}" /opt/cms/current

echo "==> Starting services"
cd /opt/cms/current
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans

echo "==> Waiting for health"
./scripts/wait-for-healthy.sh cms-api 120
./scripts/wait-for-healthy.sh nginx 60

echo "==> Running post-deploy smoke tests"
./scripts/smoke-test.sh https://cms.example.com

echo "==> Deployment ${VERSION} complete"

echo "==> Pruning old releases (keep last 3)"
ls -1dt /opt/cms/releases/*/ | tail -n +4 | xargs -r rm -rf
```

### 11.3 Rollback Procedure

Rollback re-points the `current` symlink to the previous release directory and recreates containers:

```bash
#!/usr/bin/env bash
set -euo pipefail
PREV_VERSION="${1:?usage: rollback.sh <version>}"
ln -sfn "/opt/cms/releases/${PREV_VERSION}" /opt/cms/current
cd /opt/cms/current
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
./scripts/wait-for-healthy.sh cms-api 120
./scripts/smoke-test.sh https://cms.example.com
```

**Database considerations**: rollback works only if the previous version's code is compatible with the current schema. Always design migrations to be **forward-compatible with the previous version** (see §12).

### 11.4 Deploy Approval Flow

| Step | Actor          | Action                                                |
| ---- | -------------- | ----------------------------------------------------- |
| 1    | CI             | Build + sign + push image, run staging smoke tests    |
| 2    | Tech Lead      | Review release notes, approve in deployment tool      |
| 3    | DevOps         | `ssh deploy@vm` → `cd /opt/cms` → `./current/scripts/deploy.sh 1.0.1` |
| 4    | DevOps         | Monitor logs and metrics for 15 minutes               |
| 5    | DevOps         | Mark deploy successful or trigger rollback            |

### 11.5 Deploy Windows

- **Production**: business off-hours unless emergency. Standard window: Tuesday/Thursday 21:00–23:00 local time.
- **Staging**: any time.
- **Friday afternoon deploys**: prohibited unless emergency hotfix.

---

## 12. Database Migration Strategy

### 12.1 Tooling

Prisma Migrate. Migrations are committed alongside code in `prisma/migrations/`.

### 12.2 Migration Rules

| Rule                                                                                          |
| --------------------------------------------------------------------------------------------- |
| Migrations are **forward-only** — never edit a committed migration.                            |
| Every migration is **backward-compatible with the previous app version** (so rollback works).  |
| Schema changes are split into multiple deployments when a destructive change is needed (expand → migrate data → contract). |
| Migrations run as a pre-deploy step (`docker compose run --rm cms-api node dist/scripts/migrate.js`). |
| Long-running migrations are rejected in code review — must be done in batches via background job. |

### 12.3 Expand / Contract Pattern

For a column rename `old_name → new_name`:

| Release | Migration                                          | App reads/writes              |
| ------- | -------------------------------------------------- | ----------------------------- |
| N       | ADD COLUMN new_name; backfill in batches            | reads old_name; writes both   |
| N+1     | App switches: reads new_name; writes both           | reads new_name; writes both   |
| N+2     | DROP COLUMN old_name                                 | reads new_name; writes new_name |

This guarantees the system is operable at any version overlap during deploy.

### 12.4 Migration Failure Handling

If a migration fails mid-deploy:

1. Compose start halts (pre-deploy migrate step exits non-zero).
2. Symlink is NOT switched.
3. Old containers continue serving.
4. DevOps investigates: check `docker compose logs cms-api` from the migration container.
5. If the migration is genuinely broken, revert the deploy. If transient (e.g., disk full), fix and retry.

---

## 13. Backup & Restore

### 13.1 Backup Targets

| Data                   | Tool             | Frequency        | Retention                 | Off-site? |
| ---------------------- | ---------------- | ---------------- | ------------------------- | --------- |
| Postgres               | `pg_dump`        | Hourly           | 24h hourly, 30d daily, 12w weekly | Yes (S3-compatible) |
| Postgres (WAL)         | optional `wal-g` | Continuous       | 7 days                    | Yes        |
| Media (object storage) | `mc mirror` / `aws s3 sync` | Daily | 30 days versioned         | Yes        |
| `.env` file            | encrypted copy   | On change        | 90 days                   | Yes        |
| TLS certs              | encrypted copy   | On renewal       | Last 3                    | Yes        |
| `docker-compose.*.yml` | git              | On commit        | Indefinite                | Git remote |

### 13.2 Postgres Backup

`infra/scripts/backup-postgres.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="/var/lib/cms/backups/postgres/hourly"
mkdir -p "${BACKUP_DIR}"

docker exec cms-postgres pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --format=custom \
    --compress=9 \
  > "${BACKUP_DIR}/cms-${TS}.dump"

# Verify the dump can be listed
docker exec -i cms-postgres pg_restore --list < "${BACKUP_DIR}/cms-${TS}.dump" > /dev/null

# Off-site upload via restic
restic -r "s3:s3.amazonaws.com/${BACKUP_S3_BUCKET}/postgres" \
       backup "${BACKUP_DIR}/cms-${TS}.dump" \
       --tag "hourly" --tag "v${APP_VERSION}"

# Local retention: keep 24 hourly
find "${BACKUP_DIR}" -name 'cms-*.dump' -mmin +1440 -delete
```

Scheduled via systemd timer (`/etc/systemd/system/cms-backup-postgres.timer`).

### 13.3 Media Backup

```bash
# If MinIO:
docker run --rm --network cms_cms-internal \
  -v /etc/cms/mc:/root/.mc:ro \
  minio/mc mirror --overwrite minio/cms-media s3-backup/cms-media

# If external S3:
aws s3 sync s3://cms-media s3://cms-media-backup --delete
```

### 13.4 Restore Procedure (Postgres)

```bash
# 1. Stop the app
docker compose stop cms-api cms-worker

# 2. Fetch the desired backup
restic -r "s3:..." restore <snapshot-id> --target /tmp/restore

# 3. Drop & recreate the database
docker exec cms-postgres dropdb -U cms cms
docker exec cms-postgres createdb -U cms cms

# 4. Restore
docker exec -i cms-postgres pg_restore -U cms -d cms < /tmp/restore/cms-<ts>.dump

# 5. Start the app
docker compose up -d cms-api cms-worker

# 6. Verify
./scripts/smoke-test.sh https://cms.example.com
```

### 13.5 Restore Drills

A **quarterly restore drill** is mandatory:

1. Provision a temporary VM.
2. Install Docker.
3. Pull the latest backup.
4. Restore Postgres + media.
5. Boot the app.
6. Verify smoke tests pass.
7. Document the time taken in `infra/RESTORE-DRILLS.md`.

Target: full restore in ≤ 4 hours (RTO).

---

## 14. Logging Architecture

### 14.1 Logging Principles

1. **Structured JSON** at the app level (Pino).
2. **Stdout/stderr only** from containers — never log files inside containers.
3. **Captured by Docker `json-file` driver**, then forwarded.
4. **Rotated** with `max-size: 50m, max-file: 5` per service to bound disk usage.
5. **Forwarded off-host** for retention beyond rotation (optional in MVP; recommended).

### 14.2 Log Levels

| Level    | When to use                                        |
| -------- | -------------------------------------------------- |
| `error`  | Unhandled exception, failed external call, 5xx     |
| `warn`   | Recoverable issue, retry succeeded                 |
| `info`   | Lifecycle events (start, stop), business events    |
| `debug`  | Disabled in production; enabled per-request via header for troubleshooting |

### 14.3 Log Record Schema

```json
{
  "level": "info",
  "time": "2026-05-11T10:23:45.123Z",
  "service": "cms-api",
  "version": "1.0.0",
  "env": "production",
  "request_id": "req_01HXY...",
  "user_id": "uuid-here-or-null",
  "method": "POST",
  "path": "/api/admin/content/.../publish",
  "status": 200,
  "duration_ms": 87,
  "msg": "content.publish"
}
```

PII rules per 02-SRS SEC-14: email and IP are redacted in non-security logs (only `user_id` is logged).

### 14.4 Off-Host Forwarding (Recommended)

Options:

| Option            | Notes                                             |
| ----------------- | ------------------------------------------------- |
| Vector / Fluent Bit | Lightweight forwarder; runs as host service     |
| Loki + Promtail    | Self-hosted, plays well with Grafana             |
| Cloud logs (CloudWatch, Azure Monitor) | Managed, minimal setup       |

MVP default: **Vector** running on the host, tailing the Docker log driver and shipping to Loki (self-hosted on a separate small VM) or to a managed service.

### 14.5 Log Retention

| Tier            | Retention   |
| --------------- | ----------- |
| On-VM (rotated) | ~5 days     |
| Off-host        | 30 days hot, 1 year cold |
| Audit-log specific (separate stream) | 365 days hot |

### 14.6 Sensitive Data in Logs (Blocklist)

Pino redactors strip:

- `password`, `passwordHash`, `password_hash`
- `token`, `access_token`, `refresh_token`, `jwt`, `authorization`
- `x-api-key`
- Credit card / SSN patterns (regex)
- Email addresses in non-auth log streams

---

## 15. Monitoring & Health Checks

### 15.1 Health Check Endpoints

The app exposes:

| Path           | Purpose                                          | Used by                  |
| -------------- | ------------------------------------------------ | ------------------------ |
| `/healthz`     | Liveness — is the process up?                    | Docker healthcheck, nginx |
| `/readyz`      | Readiness — can it serve traffic? (DB, Redis reachable) | Deploy script       |
| `/metrics`     | Prometheus metrics                               | Prometheus scraper       |

`/readyz` returns 503 if any critical dependency is unreachable. nginx is configured to route `/healthz` to upstream; `/readyz` is internal-only.

### 15.2 Metrics

Emitted via OpenTelemetry / Prometheus client:

| Metric                                        | Type         | Labels                       |
| --------------------------------------------- | ------------ | ---------------------------- |
| `http_requests_total`                         | counter      | method, route, status        |
| `http_request_duration_seconds`               | histogram    | method, route, status        |
| `db_query_duration_seconds`                   | histogram    | query_name                   |
| `db_pool_connections_active`                  | gauge        | —                            |
| `job_queue_size`                              | gauge        | queue_name                   |
| `job_duration_seconds`                        | histogram    | job_name, status             |
| `media_uploads_total`                         | counter      | mime_type, outcome           |
| `content_publish_total`                       | counter      | content_type                 |
| `auth_login_total`                            | counter      | outcome (success/failure)    |
| `process_resident_memory_bytes`               | gauge        | —                            |

### 15.3 Alerts (Prometheus / Alertmanager rules)

| Alert                              | Threshold                          | Severity |
| ---------------------------------- | ---------------------------------- | -------- |
| `APIDown`                          | `up{job="cms-api"} == 0` for 2 min | P1       |
| `HighErrorRate`                    | 5xx rate > 5% for 5 min            | P1       |
| `HighLatencyP95`                   | P95 > 2s for 10 min                | P2       |
| `DiskAlmostFull`                   | data disk > 85%                    | P1       |
| `DiskWarn`                         | data disk > 75%                    | P3       |
| `BackupMissing`                    | Last successful backup > 90 min ago | P1     |
| `BackupFailed`                     | Backup job exit != 0               | P2       |
| `TLSCertExpiringSoon`              | < 14 days to expiry                | P2       |
| `LoginFailureSpike`                | login_failures > 100/min for 5 min | P1 (security) |
| `WorkerQueueBacklog`               | job_queue_size > 1000 for 10 min   | P2       |
| `PostgresConnectionsExhausted`     | active conns / max > 0.8           | P2       |
| `ContainerRestartLoop`             | container restart count > 3 in 10 min | P1   |
| `OutOfMemoryKill`                  | dmesg OOM killer event             | P1       |

Alert routing:

- P1 → PagerDuty / on-call phone.
- P2 → Slack #ops + email.
- P3 → Slack #ops only.

### 15.4 Dashboards (Grafana)

Minimum panels:

1. **Overview**: request rate, error rate, P50/P95/P99 latency, uptime.
2. **API per route**: request rate and latency by endpoint.
3. **Database**: query latency, connections, slow queries, lag.
4. **Queue / Worker**: queue size, processed/failed rate.
5. **Host**: CPU, memory, disk, network (from node-exporter).
6. **Container**: per-service CPU/memory.
7. **Auth & Security**: login attempts, failures, rate-limit hits.
8. **Backups**: last successful, size, duration.

---

## 16. Security Hardening

### 16.1 Host Hardening

| Control                                                                                   |
| ----------------------------------------------------------------------------------------- |
| Disable root SSH (`PermitRootLogin no`).                                                  |
| Disable password SSH (`PasswordAuthentication no`); keys only.                            |
| Restrict SSH to bastion / VPN.                                                            |
| `fail2ban` configured for SSH.                                                            |
| `ufw` enabled (Section 5.3).                                                              |
| `unattended-upgrades` for security patches; weekly reboot window.                          |
| Disk encryption at rest (cloud provider — EBS encryption, Azure SSE).                     |
| File integrity monitoring: `aide` or `auditd` for `/etc/cms`, `/opt/cms`.                 |
| Time sync via NTP.                                                                        |
| Locale and timezone fixed.                                                                |
| Limit `sudo` users; require password.                                                     |

### 16.2 Docker Engine Hardening

| Control                                                                                   |
| ----------------------------------------------------------------------------------------- |
| Docker daemon socket not exposed over TCP.                                                |
| `/var/run/docker.sock` mode 660, group `docker`.                                          |
| Docker daemon `--userns-remap` enabled (optional but recommended).                        |
| Auto-restart containers on failure (`restart: unless-stopped`).                            |
| `--no-new-privileges` on every service.                                                    |
| Containers run as non-root (UID ≥ 1000) where possible.                                    |
| `read_only: true` root filesystem with explicit `tmpfs` for needed write paths.           |
| Drop all Linux capabilities and add only what's needed (`cap_drop: [ALL]`).                |
| Resource limits on every container.                                                       |
| Healthchecks on every container.                                                          |
| Image vulnerability scanning (Trivy) gates deploy (see 05-METRICS).                       |
| Signed images verified at pull time (`cosign verify`).                                     |

### 16.3 Application Hardening (in addition to 02-SRS §9)

| Control                                                                                   |
| ----------------------------------------------------------------------------------------- |
| HSTS preload-eligible header.                                                              |
| CSP with strict default-src.                                                               |
| Rate limiting at app and at nginx (defense in depth).                                      |
| API key prefix only displayed in UI; full key never re-fetchable.                          |
| Audit logs append-only; DB role for app lacks UPDATE/DELETE on `audit_events`.            |
| Per-request `X-Request-Id` correlation.                                                    |
| Locked-down CORS (only configured origins).                                                |
| `helmet`-style HTTP header defaults.                                                       |

### 16.4 Data Disk Encryption

The data disk (`/var/lib/cms`) is encrypted at rest by the cloud provider. If on-prem, use LUKS:

```bash
cryptsetup luksFormat /dev/sdb
cryptsetup open /dev/sdb cms-data
mkfs.ext4 /dev/mapper/cms-data
# In /etc/crypttab + /etc/fstab for boot-time mount
```

---

## 17. Capacity Planning & Resource Limits

### 17.1 Headroom Targets

| Resource                          | Target steady-state utilization |
| --------------------------------- | ------------------------------- |
| CPU                               | ≤ 50%                           |
| Memory                            | ≤ 70%                           |
| Disk                              | ≤ 60%                           |
| Network                           | ≤ 30%                           |
| Postgres connections              | ≤ 60% of pool max               |
| Redis memory                      | ≤ 70% of maxmemory              |

### 17.2 Scaling Triggers

When sustained utilization exceeds the targets above for 7+ days, plan one of:

1. **Vertical scale**: resize the VM (cloud provider operation; minutes of downtime).
2. **Storage scale**: attach larger data disk; resize partition.
3. **Move to multi-VM**: split DB to its own VM (PostgreSQL becomes managed RDS or self-hosted on a dedicated VM).
4. **Move to orchestrator**: at 3+ nodes, move to Kubernetes.

### 17.3 MVP Limits (Validated by Load Test)

Single VM (8 vCPU / 16 GB) is expected to handle:

- 200+ sustained public API RPS (mostly cache-hit).
- 50 concurrent admin users.
- < 10k content items, < 100 GB media.

Validate via the **weekly k6 staging load test** (05-METRICS M-LOAD-04).

---

## 18. Incident Response & Runbooks

### 18.1 Severity & Response

Severity definitions (mirrors 06-TEST-STRATEGY §14.2):

| Sev | Definition                                  | Response time | Escalation               |
| --- | ------------------------------------------- | ------------- | ------------------------ |
| S1  | Production down / data loss / security breach | 15 min      | Page on-call + Tech Lead |
| S2  | Major feature broken                         | 1 hour        | On-call                  |
| S3  | Minor feature impaired                       | Next business day | Backlog               |
| S4  | Cosmetic                                     | Best effort   | Backlog                  |

### 18.2 On-Call Rotation

- One on-call engineer per week, weekly handoff Monday 09:00.
- On-call carries phone, has SSH access, knows runbooks.
- Tech Lead is escalation point.

### 18.3 Standard Runbooks

Each runbook is a Markdown file in `infra/runbooks/`. Required runbooks for MVP:

| Runbook                          | Trigger                              |
| -------------------------------- | ------------------------------------ |
| `api-down.md`                    | `APIDown` alert                      |
| `database-down.md`               | Postgres healthcheck failing         |
| `high-error-rate.md`             | `HighErrorRate` alert                |
| `disk-full.md`                   | `DiskAlmostFull` alert               |
| `backup-failed.md`               | `BackupFailed` alert                 |
| `tls-cert-expiring.md`           | `TLSCertExpiringSoon` alert          |
| `login-spike.md`                 | `LoginFailureSpike` alert            |
| `rollback.md`                    | Bad deploy                           |
| `restore-from-backup.md`         | Data corruption / loss               |
| `oom-kill.md`                    | `OutOfMemoryKill` alert              |

### 18.4 Runbook Template

```markdown
# Runbook: <Name>

## Trigger
Which alert / condition activates this runbook.

## Severity
S1 / S2 / S3 / S4

## Detection
How to confirm the condition (commands, dashboards).

## Immediate actions
Step-by-step commands to mitigate (not necessarily fix).

## Investigation
Where to look (logs, metrics, traces).

## Root cause checklist
Common causes ordered by likelihood.

## Fix
Steps to fully resolve.

## Verification
How to confirm the issue is resolved.

## Post-incident
- Open ticket for permanent fix if mitigation was temporary.
- Schedule post-mortem if S1/S2.
```

### 18.5 Sample Runbook — `api-down.md`

```markdown
# Runbook: API Down

## Trigger
Alert `APIDown` (Prometheus: `up{job="cms-api"} == 0` for 2 min)

## Severity
S1

## Detection
ssh deploy@vm
docker compose ps cms-api
docker compose logs --tail=200 cms-api

## Immediate actions
1. Check container state:
   docker compose ps cms-api
2. If exited, restart:
   docker compose up -d cms-api
3. Wait for healthcheck:
   ./scripts/wait-for-healthy.sh cms-api 60
4. Verify externally:
   curl -fsS https://cms.example.com/healthz

## Investigation
- Last deploy time (was a deploy in the last hour?)
- DB reachable? docker exec cms-postgres pg_isready
- Redis reachable? docker exec cms-redis redis-cli -a "$REDIS_PASSWORD" ping
- Disk full? df -h /var/lib/cms
- OOM? dmesg | tail -50 | grep -i 'killed process'

## Root cause checklist
1. Bad deploy → rollback (see rollback.md)
2. DB connection exhausted → check `pg_stat_activity`; restart cms-api
3. Disk full → see disk-full.md
4. OOM → see oom-kill.md; consider increasing memory limit
5. External dependency hung (SMTP, S3) → check egress; circuit-break if needed

## Fix
Address root cause; restart affected service(s); verify health.

## Verification
- curl /healthz returns 200
- Error rate back to baseline on dashboard
- 5 minutes of green metrics

## Post-incident
- Update incident log
- If recurring, file ticket for permanent fix
- Post-mortem required (S1)
```

---

## 19. Disaster Recovery

### 19.1 DR Objectives

| Metric          | Target                |
| --------------- | --------------------- |
| RPO (data loss) | ≤ 1 hour              |
| RTO (recovery)  | ≤ 4 hours             |

### 19.2 DR Scenarios

| Scenario                       | Procedure                                         |
| ------------------------------ | ------------------------------------------------- |
| VM lost (cloud provider issue) | Provision new VM in alternate AZ → restore from off-site backup |
| Data disk lost                 | Attach replacement disk → restore from off-site backup |
| Region outage                  | Provision new VM in alternate region → DNS update → restore |
| Backup corruption              | Use earlier known-good backup; data loss within RPO window |
| Catastrophic data deletion     | Restore from backup; investigate root cause       |
| Ransomware / breach            | Isolate VM → forensic snapshot → rebuild from clean backup → rotate ALL secrets |

### 19.3 DR Build Script

`infra/scripts/dr-build.sh` rebuilds a working VM from scratch:

1. Provision VM with Terraform (or manual).
2. Run `host-bootstrap.sh` (installs Docker, ufw, etc.).
3. Clone `cms-infra` repo at the desired release tag.
4. Restore `.env` from encrypted backup.
5. Restore data disk contents from off-site backup.
6. `docker compose up -d`.
7. Run smoke tests.

Total target time: ≤ 4 hours; validated by quarterly drill.

### 19.4 DR Drill Calendar

- **Quarterly**: full restore drill on a throwaway VM.
- **Annually**: simulated region outage with full DR build.

---

## 20. Maintenance Procedures

### 20.1 Routine Maintenance

| Task                                       | Frequency   | Owner   |
| ------------------------------------------ | ----------- | ------- |
| OS security updates                         | Weekly (auto) | Host  |
| Docker images: minor/patch updates          | Monthly      | DevOps |
| TLS cert renewal                            | Automatic (Let's Encrypt) | certbot |
| Database VACUUM ANALYZE                     | Weekly       | Postgres autovacuum + manual |
| Log volume audit                            | Monthly      | DevOps |
| Backup retention pruning                    | Daily (auto) | Backup script |
| Restore drill                               | Quarterly    | DevOps + Tech Lead |
| Disaster recovery drill                     | Annual       | Tech Lead |
| Secret rotation                             | Per §8.4 schedule | DevOps |
| Dependency updates                          | Weekly (Dependabot PRs) | Dev team |
| Capacity review                             | Monthly      | Tech Lead |

### 20.2 Planned Maintenance Windows

Same as deploy windows (§11.5). Customers notified via status page if downtime > 5 minutes is expected.

### 20.3 Decommissioning

When sun-setting an environment:

1. Final backup taken and archived for retention period.
2. Containers stopped: `docker compose down`.
3. Volumes snapshotted then deleted.
4. VM stopped, snapshot retained 90 days, then deleted.
5. DNS records removed.
6. Cloud resources (IPs, disks) released.
7. Secrets rotated (in case any were shared with other systems).

---

## 21. Risks & Limitations

| ID    | Risk / Limitation                                          | Impact | Mitigation                                              |
| ----- | ---------------------------------------------------------- | ------ | ------------------------------------------------------- |
| OR-01 | Single VM = single point of failure                         | High   | Tight RTO/RPO; quarterly DR drills; documented rebuild  |
| OR-02 | Local-disk `.env` for secrets has weak rotation tooling     | Medium | Generation scripts + rotation calendar; migrate to Vault later |
| OR-03 | Co-tenancy of DB + app on same VM (resource contention)     | Medium | Resource limits per container; alerting on saturation   |
| OR-04 | Self-hosted MinIO has lower durability than S3              | Medium | Off-site backup of media bucket daily                   |
| OR-05 | No automatic failover                                       | Medium | Documented manual DR; aligned with SLO (99.5%)          |
| OR-06 | Docker Compose lacks rolling-update guarantees of K8s       | Low    | Healthchecks gate readiness; brief 502s acceptable      |
| OR-07 | `unattended-upgrades` may reboot at inconvenient times      | Low    | Configure reboot window; coordinate with deploy windows |
| OR-08 | Logs lost if forwarding pipeline breaks                     | Low    | Local rotation retains ~5 days; alert on forwarder lag  |
| OR-09 | Increase in users beyond MVP scale requires re-architecture | Medium | Capacity plan + scaling triggers defined (§17.2)        |
| OR-10 | Bind-mount permissions drift between releases               | Low    | Permissions enforced in deploy script; periodic audit    |

### 21.1 Migration Path Beyond Single VM

When the system outgrows the single VM:

```
Stage 1 (MVP):          Single VM, Docker Compose, .env
                              ↓
Stage 2 (Growth):       Split DB to its own VM (managed Postgres preferred)
                        App VM still single, Compose unchanged
                              ↓
Stage 3 (Scale):        Move app to a 3-node managed Kubernetes cluster
                        Secrets to Vault / cloud secret manager
                        Media to managed S3
                        Add CDN
                              ↓
Stage 4 (Mature):       Multi-region active-passive
                        Read replicas
                        Global CDN
                        Full SLO-driven operations
```

The application code does not change between stages; only operational architecture does. This is enabled by the hexagonal architecture (04-ARCH).

---

## 22. Appendices

### 22.1 Appendix A — Host Bootstrap Script Skeleton

```bash
#!/usr/bin/env bash
# infra/host-bootstrap.sh — run once on a fresh VM
set -euo pipefail

# OS update
apt-get update && apt-get upgrade -y

# Base packages
apt-get install -y \
    curl jq git ca-certificates gnupg \
    ufw fail2ban unattended-upgrades \
    restic awscli

# Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Users
useradd --create-home --shell /bin/bash deploy || true
usermod -aG docker deploy

# Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow from ${BASTION_IP} to any port 22 proto tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Fail2ban
systemctl enable --now fail2ban

# Unattended upgrades
dpkg-reconfigure -plow unattended-upgrades

# Data disk mount
if [ -b /dev/sdb ] && ! mount | grep -q /var/lib/cms; then
    mkfs.ext4 /dev/sdb
    mkdir -p /var/lib/cms
    echo "/dev/sdb /var/lib/cms ext4 defaults,nofail 0 2" >> /etc/fstab
    mount /var/lib/cms
fi

# Directories
mkdir -p /var/lib/cms/{postgres,redis,minio,uploads-staging,backups/{postgres/{hourly,daily},env,audit}}
mkdir -p /opt/cms/{releases,shared/env,shared/secrets}
mkdir -p /etc/cms/tls
mkdir -p /var/log/cms

chown -R deploy:deploy /opt/cms
chmod 700 /var/lib/cms/backups

# Time
timedatectl set-timezone UTC

# Done
echo "Host bootstrap complete. Reboot recommended."
```

### 22.2 Appendix B — Smoke Test Script Skeleton

```bash
#!/usr/bin/env bash
# infra/scripts/smoke-test.sh
set -euo pipefail
BASE="${1:-https://cms.example.com}"

echo "1. Health"
curl -fsS "${BASE}/healthz" >/dev/null

echo "2. Public API (unauthenticated, should 401)"
test "$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/v1/articles")" = "401"

echo "3. Public API with key"
curl -fsS -H "X-API-Key: ${SMOKE_API_KEY}" "${BASE}/api/v1/articles" | jq '.data | length' >/dev/null

echo "4. Admin SPA"
curl -fsS "${BASE}/" | grep -qi '<title'

echo "All smoke checks passed."
```

### 22.3 Appendix C — `wait-for-healthy.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
SVC="${1:?service required}"
TIMEOUT="${2:-60}"

deadline=$(( SECONDS + TIMEOUT ))
while (( SECONDS < deadline )); do
    status=$(docker inspect --format='{{.State.Health.Status}}' "${SVC}" 2>/dev/null || echo "missing")
    if [ "$status" = "healthy" ]; then
        echo "${SVC} is healthy"
        exit 0
    fi
    sleep 2
done

echo "Timed out waiting for ${SVC} (last status: ${status})" >&2
docker logs --tail=100 "${SVC}" >&2 || true
exit 1
```

### 22.4 Appendix D — File / Directory Permissions Audit

A scheduled job (`infra/scripts/audit-perms.sh`, weekly) verifies critical permissions and alerts on drift:

```bash
#!/usr/bin/env bash
set -euo pipefail

declare -A EXPECTED=(
  ["/opt/cms/current/.env"]="600 deploy:deploy"
  ["/etc/cms/tls/privkey.pem"]="640 root:nginx"
  ["/var/lib/cms/postgres"]="700"
  ["/var/lib/cms/backups"]="700 deploy:deploy"
)

failed=0
for path in "${!EXPECTED[@]}"; do
    expected="${EXPECTED[$path]}"
    actual_mode=$(stat -c '%a' "$path")
    actual_owner=$(stat -c '%U:%G' "$path")
    if ! echo "${actual_mode} ${actual_owner}" | grep -q "${expected%% *}"; then
        echo "DRIFT: $path  expected=${expected}  actual=${actual_mode} ${actual_owner}" >&2
        failed=1
    fi
done
exit $failed
```

### 22.5 Appendix E — Glossary

| Term                  | Definition                                                       |
| --------------------- | ---------------------------------------------------------------- |
| VM                    | Virtual Machine                                                  |
| Docker Engine          | Container runtime daemon                                          |
| Docker Compose        | Tool to define and run multi-container Docker applications        |
| `.env` file           | Plain-text key=value file consumed by Docker Compose             |
| Bind mount            | A directory on the host directly mounted into a container        |
| Healthcheck           | Periodic command Docker runs to determine container liveness      |
| Blue/green deploy     | Two parallel environments swapped at cutover                     |
| RPO                   | Recovery Point Objective — max acceptable data loss              |
| RTO                   | Recovery Time Objective — max acceptable downtime                |
| Expand/Contract       | Database migration pattern enabling zero-downtime schema changes |
| Restic                | Encrypted, deduplicated backup tool                              |
| MinIO                 | S3-compatible self-hosted object storage                         |
| node-exporter         | Prometheus exporter for host-level metrics                       |
| OOM killer            | Linux kernel mechanism to kill processes under memory pressure   |
| HSTS                  | HTTP Strict Transport Security                                   |
| Cosign                | Tool for signing and verifying container images                  |

### 22.6 Appendix F — Document Change Log

| Version | Date       | Author | Change                                  |
| ------- | ---------- | ------ | --------------------------------------- |
| 1.0     | 2026-05-11 | —      | Initial single-VM operational arch      |

---

**End of Document**
