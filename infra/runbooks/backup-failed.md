# Runbook: Backup Failed

## Trigger

A backup unit failed, or the last success is over 90 minutes old. That is more than the one hour RPO.

## Severity

S2. S1 if no good backup exists from the last day.

## Detection

```bash
systemctl status cms-backup-postgres.service cms-backup-daily.service
journalctl -u cms-backup-postgres.service --since -6h
date -d "@$(cat /var/lib/cms/backups/postgres/last-success)"
```

## Immediate actions

Run it by hand and read the output: `scripts/backup.sh postgres`

## Investigation

- `pg_dump` errors: is Postgres healthy? [database-down.md](database-down.md).
- `.partial` files left in `hourly/` mark dumps that failed. They are safe to delete.
- restic `unable to open repository`: credentials or network. Check `BACKUP_RESTIC_REPOSITORY`, the
  `BACKUP_S3_*` values, and that the bucket exists.
- restic `wrong password`: `RESTIC_PASSWORD` no longer matches the repository. Do not initialize a new
  one over it. Find the right value in the break-glass record.
- restic `repository is already locked`: make sure no backup is running, then unlock it through the
  restic image, with the same environment that `scripts/backup.sh` uses.
- No space: [disk-full.md](disk-full.md).

## Root cause checklist

1. Off-site credentials expired or rotated
2. Disk full
3. Postgres down when the timer fired
4. Network or provider outage

## Fix

Correct the cause and run `scripts/backup.sh all`.

## Verification

`last-success` is current, the dump passes `pg_restore --list`, which the script checks, and the new
snapshot appears off site.

## Post-incident

If more than an hour went unprotected, record the exposure in the incident log.
