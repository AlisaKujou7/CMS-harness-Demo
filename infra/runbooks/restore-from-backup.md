# Runbook: Restore From Backup

## Trigger

Data is corrupted or lost, and nothing less will recover it. Restoring discards everything written since
the backup, up to the one hour RPO, so the Tech Lead decides. The audit log goes back too.

## Severity

S1

## Detection

Confirm what is lost and since when. Take a dump of the current state first, even a damaged one:

```bash
scripts/backup.sh postgres
```

## Immediate actions

**Database**, from a local dump. It stops the API and worker meanwhile, and applies any migrations newer
than the dump before starting them again:

```bash
ls -t /var/lib/cms/backups/postgres/hourly | head
scripts/restore.sh postgres /var/lib/cms/backups/postgres/hourly/cms-<timestamp>.dump
```

**Database, from off site**, when the disk is gone:

```bash
scripts/restore.sh snapshot latest /tmp/restore
scripts/restore.sh postgres /tmp/restore/backup/postgres/cms-<timestamp>.dump
sudo rm -rf /tmp/restore
```

Remove it afterwards, because a snapshot can hold `.env`, and restic restores files as their original
owners.

`latest` means the newest snapshot of any kind, so use the id from `restic snapshots` to pick one that
holds what you need.

**Media**, with the bundled gateway. It replaces the bucket's files with the snapshot's:

```bash
scripts/restore.sh media latest
```

With S3, copy back from the backup bucket:
`aws s3 sync s3://<backup bucket> s3://<media bucket>`.

**The whole VM:** run `host-bootstrap.sh`, then `scripts/dr-build.sh <version>`.

## Investigation

A restored database can name media that is newer than the media snapshot, since they are taken at
different times. Those images show as missing, and the worker's sweeps leave them be.

## Root cause checklist

1. A person or a release deleted the data
2. Disk failure
3. A breach. See 07-OPS-ARCH 19.2 before touching anything: isolate and snapshot first, then rotate
   every secret afterwards.

## Fix

Fix what caused the loss, or it will recur after the restore.

## Verification

```bash
scripts/smoke-test.sh https://cms.example.com
```

Then sign in and check the content that was lost, and that an image loads. Sign-ins made after the backup
no longer exist, so people may need to sign in again.

## Post-incident

Post-mortem required. Tell users what was lost, and record the time taken against the 4 hour RTO.
