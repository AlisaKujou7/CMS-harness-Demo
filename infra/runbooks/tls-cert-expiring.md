# Runbook: TLS Certificate Expiring

## Trigger

Under 14 days until the certificate expires.

## Severity

S2. S1 once it has expired, because browsers will refuse the site, and HSTS leaves no way to click through.

## Detection

```bash
echo | openssl s_client -connect cms.example.com:443 -servername cms.example.com 2>/dev/null | openssl x509 -noout -enddate
sudo certbot certificates
systemctl status certbot.timer
```

## Immediate actions

Renew, then copy and reload, as root:

```bash
certbot renew
cp /etc/letsencrypt/live/cms.example.com/fullchain.pem /etc/cms/tls/fullchain.pem
cp /etc/letsencrypt/live/cms.example.com/privkey.pem /etc/cms/tls/privkey.pem
chown root:101 /etc/cms/tls/privkey.pem
chmod 640 /etc/cms/tls/privkey.pem
```

Then, as `deploy`: `scripts/compose.sh exec nginx nginx -s reload`

## Investigation

- Challenge failing: port 80 must reach nginx, and `/.well-known/acme-challenge/` is served from
  `/var/www/certbot`.
- Renewed but still old on the site: the renewal hook did not copy or reload.
- Rate limited by Let's Encrypt: wait, and do not retry in a loop.

## Root cause checklist

1. The renewal hook is missing or broken
2. Port 80 is blocked
3. DNS changed
4. certbot's timer is disabled

## Fix

Repair what stopped renewal, then test it: `certbot renew --dry-run`

## Verification

The `openssl` command above shows the new date, for both the site and the media name.

## Post-incident

Keep an encrypted copy of the new certificate (07-OPS-ARCH 13.1).
