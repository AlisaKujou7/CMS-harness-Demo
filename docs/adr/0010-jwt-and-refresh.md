# ADR-0010: Short-lived JWT with opaque rotating refresh tokens

## Status

Accepted

## Context

Sessions must be revocable, and SEC-12 requires a 30 minute idle expiry.

## Decision

Access tokens last 15 minutes and stay in memory. Refresh tokens last up to 14 days, are stored hashed, rotate with reuse detection and travel in an httpOnly, Secure, SameSite=Strict cookie. The cookie-authenticated refresh and logout routes therefore need CSRF protection under SEC-11.

Implementation notes:

- Using a refresh token issues its replacement, so a token's age is the session's idle time. A token older than 30 minutes is expired, which implements SEC-12.
- Replaying a token counts as theft only when that token was rotated. A token revoked by logout or a password change is refused quietly, because another device may still hold it, and treating it as theft would end the sessions started since.
- A rotated token stays usable for 10 seconds, because tabs share one cookie and can refresh at once. Each such use gets its own replacement. The trade-off is that a stolen token replayed inside those 10 seconds is not detected.
- Every rotation keeps the family's absolute expiry, capped at 14 days.
- Refresh and logout require the header `X-Requested-With: cms-admin`. A cross-site form cannot set it, and CORS stops scripts on other origins from setting it.
- The access token is verified and then the account is read on every request, so deactivation and role changes apply at once. This costs one query per admin request, which is acceptable at 50 concurrent admins.
- `JWT_SECRET_PREVIOUS` verifies only, which allows rotation without signing everyone out (SEC-10).

## Consequences

- Positive: revocation works and XSS cannot read the refresh token.
- Negative: rotation state must be stored server side.

## Alternatives Considered

Long-lived JWTs, rejected because they cannot be revoked (FR-AUTH-05).
