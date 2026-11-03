# Runbook: Login Failure Spike

## Trigger

More than 100 failed logins a minute for 5 minutes.

## Severity

S1 (security)

## Detection

```bash
scripts/compose.sh logs --since=10m nginx | grep '/api/admin/auth/login' | grep -o '"status":[0-9]*' | sort | uniq -c
scripts/compose.sh logs --since=10m nginx | grep '/api/admin/auth/login' | grep -o '"remote_addr":"[^"]*"' | sort | uniq -c | sort -rn | head
```

## Immediate actions

The limits are already working: nginx limits each address, the API allows 10 logins a minute per
address, and accounts lock for 15 minutes after 5 failures.

1. If a few addresses dominate, block them, as root: `ufw insert 1 deny from <address>`
2. Tell the Security Lead.

## Investigation

- Did any attempt succeed from those addresses? In **Audit**, filter on sign-ins, or query
  `audit_events` directly.
- Many accounts tried with few passwords suggests spraying, and one account many times suggests targeting.
- If all traffic appears to come from one address, a proxy has been added in front of nginx, and it must
  be accounted for, since the API trusts exactly one hop.

## Root cause checklist

1. Credential stuffing or spraying
2. A misbehaving integration retrying with an old password

## Fix

Keep blocks in place while it lasts. **Reset password** for any account that may be compromised, and
**Deactivate** it first if it is being used.

## Verification

Failures return to baseline, and no unexplained successful sign-ins remain.

## Post-incident

Post-mortem required. Consider whether MFA, deferred under Q-2, should move up.
