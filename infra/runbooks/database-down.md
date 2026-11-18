# Runbook: Database Down

## Trigger

The Postgres health check fails, or `/readyz` answers 503.

## Severity

S1

## Detection

```bash
scripts/compose.sh ps postgres
scripts/compose.sh logs --tail=200 postgres
scripts/compose.sh exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

## Immediate actions

1. If it exited, start it: `scripts/compose.sh up -d --wait postgres`
2. Then the application, which reconnects by itself but may need a push:
   `scripts/compose.sh up -d cms-api cms-worker`

## Investigation

- `No space left on device` in the log: [disk-full.md](disk-full.md).
- `could not write lock file` or `Permission denied`: compare `stat /var/lib/cms/postgres` with
  `scripts/audit-perms.sh`. The directory must be 700, owned by 70:70.
- Too many connections:
  `scripts/compose.sh exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT usename, state, count(*) FROM pg_stat_activity GROUP BY 1, 2"'`
- `password authentication failed for user "cms_app"` in the API's log means `CMS_APP_DB_PASSWORD`
  changed without being applied. Run `scripts/migrate.sh`, which sets the role's password from `.env`.

## Root cause checklist

1. Disk full
2. Out of memory: [oom-kill.md](oom-kill.md)
3. Permissions drift on the data directory
4. Corrupt data, shown by checksum or `invalid page` errors: [restore-from-backup.md](restore-from-backup.md)

## Fix

Address the root cause and restart. Do not delete anything under `/var/lib/cms/postgres` by hand.

## Verification

`/readyz` says ready, and `scripts/smoke-test.sh https://cms.example.com` passes.

## Post-incident

- Take a fresh backup: `scripts/backup.sh postgres`
- Post-mortem required (S1).
