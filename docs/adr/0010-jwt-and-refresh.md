# ADR-0010: Short-lived JWT with opaque rotating refresh tokens

## Status

Accepted

## Context

Sessions must be revocable, and SEC-12 requires a 30 minute idle expiry.

## Decision

Access tokens last 15 minutes and stay in memory. Refresh tokens last up to 14 days, are stored hashed, rotate with reuse detection and travel in an httpOnly, Secure, SameSite=Strict cookie. The cookie-authenticated refresh and logout routes therefore need CSRF protection under SEC-11.

## Consequences

- Positive: revocation works and XSS cannot read the refresh token.
- Negative: rotation state must be stored server side.

## Alternatives Considered

Long-lived JWTs, rejected because they cannot be revoked (FR-AUTH-05).
