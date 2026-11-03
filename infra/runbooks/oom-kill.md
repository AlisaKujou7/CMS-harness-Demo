# Runbook: Out Of Memory Kill

## Trigger

The kernel's OOM killer ended a process, or a container has exit code 137.

## Severity

S1 if a service stays down, otherwise S2

## Detection

```bash
dmesg | grep -i 'killed process' | tail
docker inspect --format '{{.Name}} oom={{.State.OOMKilled}} restarts={{.RestartCount}}' $(docker ps -aq --filter name=cms-)
docker stats --no-stream
free -h
```

## Immediate actions

Containers restart by themselves. Confirm: `scripts/compose.sh ps`. If one is in a restart loop, raise
its limit in `docker-compose.prod.yml`, if the host has room, and run `scripts/compose.sh up -d <service>`.

## Investigation

- `cms-worker` (768 MB): many large images processed at once. sharp holds decoded images in memory.
- `cms-api` (1 GB): argon2 uses about 19 MB per hash, so a login flood adds up. Check
  [login-spike.md](login-spike.md).
- `postgres` (2 GB): `shared_buffers` plus `work_mem` for each connection.
- `redis` (1.2 GB limit, 1 GB `maxmemory`): it refuses writes before the limit, so a kill here suggests
  the append-only log's rewrite. Look at `info memory`.
- The host itself out of memory, not a container limit: the limits add up to more than the VM.

## Root cause checklist

1. A real need for more memory
2. A leak: memory that climbs steadily between restarts
3. A burst of uploads or logins

## Fix

Raise the limit, resize the VM (07-OPS-ARCH 17.2), or fix the leak in a release.

## Verification

No restarts for an hour, memory steady, and the smoke test passes.

## Post-incident

Update the capacity review, and open a ticket for a leak.
