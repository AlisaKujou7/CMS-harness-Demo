# Operations runbook

How to install, deploy, back up, restore and triage the CMS on its single VM. 07-OPS-ARCH is the design
behind this. Commands run from `/opt/cms/current` as `deploy`, unless they say otherwise.

`scripts/compose.sh` is `docker compose` with this environment's files, so use it for everything.

## Try it locally

Needs Docker, curl and openssl. On Windows, use Git Bash.

```bash
infra/scripts/local-up.sh
```

This builds the images, creates secrets and a self-signed certificate in `infra/.local` and `infra/.env`,
starts the stack and runs both smoke tests. Then:

| What          | Where                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Admin SPA     | <https://localhost:8443>, after accepting the certificate warning     |
| Media host    | <https://media.localhost:8443>, which needs the same warning accepted |
| Mail          | <http://localhost:8025>                                               |
| Admin sign-in | `infra/.local/admin.env`                                              |

To check it in a real browser, including the policy headers and uploads to storage, sign-in details
being those in `admin.env`:

```bash
COMPOSE_ADMIN_EMAIL=admin@cms.test COMPOSE_ADMIN_PASSWORD=... pnpm --filter cms-web test:compose
```

`infra/scripts/local-down.sh` stops it, and `--wipe` also deletes its data and secrets.

## First install

1. Provision the VM (07-OPS-ARCH 3.1), with the data disk attached, and DNS for the site and media names.
2. As root, from a checkout: `BASTION_IP=... infra/host-bootstrap.sh`
3. As root, get a certificate covering both names, and allow nginx to read it:

   ```bash
   certbot certonly --webroot -w /var/www/certbot -d cms.example.com -d media.cms.example.com
   ```

   certbot's webroot needs nginx up, so on a new VM use `--standalone` for the first one. Copy
   `fullchain.pem` and `privkey.pem` to `/etc/cms/tls`, then `chown root:101` and `chmod 640` the key. Add a
   renewal hook that copies them again and runs `scripts/compose.sh exec nginx nginx -s reload`.

4. As `deploy`, create the environment, then fill in its `__SET_ME__` values and public names:

   ```bash
   infra/scripts/generate-secrets.sh infra/.env.example /opt/cms/shared/env/.env.production
   echo 'CMS_REPO_URL=https://github.com/org/cms.git' > /opt/cms/deploy.conf
   ```

5. With media in AWS S3 rather than the bundled gateway: remove `self-hosted-storage` from
   `COMPOSE_PROFILES`, set `OBJECT_STORAGE_PROVIDER=s3`, blank the endpoint, point
   `OBJECT_STORAGE_PUBLIC_URL` at the bucket, and run `scripts/configure-s3-bucket.sh` once. Browsers
   upload directly, so without this every upload fails.
6. Deploy with `infra/scripts/deploy.sh 1.0.0` from the checkout, since `current` does not exist yet.
   With no key yet, its smoke test skips the check that needs one.
7. Create the first Admin, then issue a key in **API Keys**, and put it in `SMOKE_API_KEY`:

   ```bash
   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... scripts/seed-admin.sh
   ```

8. Store `RESTIC_PASSWORD`, the repository address and its credentials outside the VM. Without them, an
   off-site backup cannot be read.

## Deploy

After Tech Lead approval, in the window in 07-OPS-ARCH 11.5:

```bash
/opt/cms/current/scripts/deploy.sh 1.0.1
```

It verifies signatures, runs migrations, switches release and runs the smoke test. A failed migration
leaves the old release serving. A later failure rolls back by itself and exits non-zero. Watch logs and
error rates for 15 minutes afterwards. To go back later, see [rollback.md](rollback.md).

Changing `.env` needs `scripts/compose.sh up -d` and a line in `CHANGELOG.env.md`, without values.

## Back up

Timers do this: `cms-backup-postgres` hourly, `cms-backup-daily` for media and `.env`. To run one now:

```bash
scripts/backup.sh postgres
```

Check with `systemctl list-timers 'cms-*'`, and `/var/lib/cms/backups/postgres/last-success` holds the
time of the last good one. Quarterly drills go in `RESTORE-DRILLS.md`.

## Restore

See [restore-from-backup.md](restore-from-backup.md). For a lost VM, use `scripts/dr-build.sh`.

## Triage

1. `scripts/compose.sh ps` shows what is down or unhealthy.
2. `curl -fsS https://cms.example.com/healthz` tells you whether nginx and the API answer.
3. `scripts/compose.sh exec nginx wget -qO- http://cms-api:3000/readyz` tells you whether the API reaches
   Postgres and Redis.
4. `scripts/compose.sh logs --tail=200 <service>`. Logs are JSON, one record per line, and `request_id`
   connects nginx's record to the API's.
5. `df -h /var/lib/cms` and `dmesg | grep -i 'killed process'` cover the two usual host causes.

The API image has no shell, by design. To look around inside its network, use the nginx container.

| Symptom                                 | Go to                                            |
| --------------------------------------- | ------------------------------------------------ |
| Site or API unreachable                 | [api-down.md](api-down.md)                       |
| Postgres unhealthy, or `readyz` failing | [database-down.md](database-down.md)             |
| Many 5xx responses                      | [high-error-rate.md](high-error-rate.md)         |
| Disk over 75%                           | [disk-full.md](disk-full.md)                     |
| A backup failed or is late              | [backup-failed.md](backup-failed.md)             |
| Certificate expires within 14 days      | [tls-cert-expiring.md](tls-cert-expiring.md)     |
| Burst of failed logins                  | [login-spike.md](login-spike.md)                 |
| A bad release                           | [rollback.md](rollback.md)                       |
| Data lost or corrupted                  | [restore-from-backup.md](restore-from-backup.md) |
| Containers killed for memory            | [oom-kill.md](oom-kill.md)                       |

Worker or queue trouble: mail not arriving and scheduled content not publishing both point at
`cms-worker`. Check its health and logs. Redis runs with `noeviction`, so if it fills, new jobs and
cache writes fail rather than queued jobs vanishing. `scripts/compose.sh exec redis redis-cli info memory`
shows how full it is.

## What is not in place yet

Nothing raises the alerts these runbooks name. The API has no `/metrics`, and Prometheus, Alertmanager,
Grafana, Sentry and log forwarding are not set up. Only host metrics exist, from node-exporter on
`127.0.0.1:9100`. Until that changes, run the Detection steps by hand or from an external uptime check.
