# Outbound destinations

Containers reach the internet directly, and `ufw` on the host is the control point (07-OPS-ARCH 5.2).
Any new destination is added here before it is used.

| Destination                     | Port | From         | Why                                    |
| ------------------------------- | ---- | ------------ | -------------------------------------- |
| SMTP provider, `SMTP_HOST`      | 587  | `cms-worker` | Transactional email                    |
| S3 service, if external         | 443  | API, worker  | Media, only with `s3` as the provider  |
| Off-site backup repository      | 443  | Backup jobs  | restic, and `aws s3 sync` for S3 media |
| `ghcr.io`, Docker Hub, `gcr.io` | 443  | Host         | Image pulls during deploy              |
| Let's Encrypt                   | 443  | Host         | Certificate renewal                    |
| Sigstore (`*.sigstore.dev`)     | 443  | Host         | `cosign verify` during deploy          |
| OS and Docker package mirrors   | 443  | Host         | Security updates                       |
