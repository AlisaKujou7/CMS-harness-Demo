# Runbook: Rollback

## Trigger

A release is causing errors that it did not have before. `deploy.sh` does this by itself when its own
checks fail, so this is for what shows up afterwards.

## Severity

As the problem it fixes, usually S1 or S2

## Detection

```bash
ls -1t /opt/cms/releases
readlink -f /opt/cms/current
```

## Immediate actions

```bash
/opt/cms/current/scripts/rollback.sh <previous version>
```

It repoints `current`, recreates the containers, waits for health and runs the smoke test. The last 3
releases stay on the VM.

## Investigation

Migrations do not roll back. Each is compatible with the release before it (07-OPS-ARCH 12.2), so the
older code runs on the newer schema. If the older release fails against it anyway, that migration broke
the rule: stop and use [restore-from-backup.md](restore-from-backup.md) only with the Tech Lead's decision,
because it loses data written since the backup.

## Root cause checklist

1. A code defect in the release
2. A new `.env` variable, or a changed value, that the older release does not expect
3. A migration that broke compatibility

## Fix

Fix forward in a new release. Never edit a committed migration.

## Verification

`readlink -f /opt/cms/current` names the older release, the smoke test passes, and errors stop.

## Post-incident

Post-mortem required for S1 and S2. Record which release is bad, so that nobody deploys it again.
