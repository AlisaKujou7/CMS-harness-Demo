# Runbook: API Down

## Trigger

`/healthz` fails from outside, or the `APIDown` alert once monitoring exists.

## Severity

S1

## Detection

```bash
scripts/compose.sh ps cms-api nginx
scripts/compose.sh logs --tail=200 cms-api
curl -fsS https://cms.example.com/healthz
```

## Immediate actions

1. If the container exited, start it: `scripts/compose.sh up -d cms-api`
2. Wait for it: `scripts/wait-for-healthy.sh cms-api 60`
3. Verify from outside: `curl -fsS https://cms.example.com/healthz`

## Investigation

- `Invalid environment:` at the top of the log names a bad variable in `.env`.
- Was there a deploy in the last hour? `ls -lt /opt/cms/releases`
- Dependencies: `scripts/compose.sh exec nginx wget -qO- http://cms-api:3000/readyz`
- Disk: `df -h /var/lib/cms`. Memory: `dmesg | grep -i 'killed process'`

## Root cause checklist

1. Bad deploy: [rollback.md](rollback.md)
2. Database down or out of connections: [database-down.md](database-down.md)
3. Disk full: [disk-full.md](disk-full.md)
4. Out of memory: [oom-kill.md](oom-kill.md)
5. nginx alone is down, with the API healthy: `scripts/compose.sh logs nginx` usually names a missing
   certificate file.

## Fix

Address the root cause, then restart what it affected.

## Verification

`/healthz` returns 200, `scripts/smoke-test.sh https://cms.example.com` passes, and logs show no new
errors for 5 minutes.

## Post-incident

- Update the incident log, and open a ticket if the fix was temporary.
- Post-mortem required (S1).
