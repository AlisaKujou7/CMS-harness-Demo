# Runbook: High Error Rate

## Trigger

More than 5% of responses are 5xx for 5 minutes, from an external check or the `HighErrorRate` alert.

## Severity

S1 when most requests fail, otherwise S2

## Detection

```bash
scripts/compose.sh logs --since=10m nginx | grep -c '"status":5'
scripts/compose.sh logs --since=10m cms-api | grep '"level":"error"' | tail -20
```

## Immediate actions

If a deploy happened in the last hour, roll back first and investigate after: [rollback.md](rollback.md).

## Investigation

- Which paths? `scripts/compose.sh logs --since=10m nginx | grep '"status":5' | grep -o '"path":"[^"]*"' | sort | uniq -c | sort -rn | head`
- 502 from nginx means the API is restarting or unreachable: [api-down.md](api-down.md).
- 503 from `/readyz`: [database-down.md](database-down.md).
- Failures only on media: `scripts/compose.sh ps object-storage`, and check its disk.
- Redis out of memory shows as `OOM command not allowed` in the logs. Queued jobs stay safe, but find
  what filled it: `scripts/compose.sh exec redis redis-cli info keyspace`.

## Root cause checklist

1. Bad deploy
2. A dependency down or slow
3. Exhausted connections or memory
4. A traffic surge. The public API allows 60 requests a minute per key, and nginx limits each address.

## Fix

Roll back, restart or scale the resource limit in `docker-compose.prod.yml`, according to the cause.

## Verification

5xx responses return to baseline for 10 minutes, and the smoke test passes.

## Post-incident

Post-mortem required for S1 and S2.
