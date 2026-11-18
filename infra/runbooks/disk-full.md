# Runbook: Disk Full

## Trigger

The data disk is over 85% (over 75% is a warning), or `No space left on device` appears in logs.

## Severity

S1 at 85% and above, otherwise S3

## Detection

```bash
df -h /var/lib/cms /
sudo du -sh /var/lib/cms/*
docker system df
```

## Immediate actions

Free space safely, in this order:

1. Unused images: `docker image prune -a --filter until=168h`
2. Old local dumps, once they are confirmed off site:
   `find /var/lib/cms/backups/postgres/hourly -name 'cms-*.dump' -mmin +360 -delete`

Never delete under `postgres/`, `redis/` or `object-storage/` to make room.

## Investigation

- Container logs are limited to 250 MB per service, so they fill the root disk only if the limits were
  removed: `sudo du -sh /var/lib/docker/containers/*`.
- A growing `object-storage/cms-media/uploads` means abandoned uploads, which the worker purges daily, so
  check that `cms-worker` is healthy.
- A growing Postgres with little new content: check autovacuum, and look at `pg_stat_user_tables`.

## Root cause checklist

1. Media growth
2. Local backups accumulating because retention failed
3. Stopped worker, so nothing purges
4. Database bloat

## Fix

If growth is real, attach a larger disk and resize the filesystem (07-OPS-ARCH 17.2). Moving media to
S3 is the longer-term relief.

## Verification

Below 75%, writes succeed, and the smoke test passes.

## Post-incident

Update the capacity review, and post-mortem if it reached S1.
