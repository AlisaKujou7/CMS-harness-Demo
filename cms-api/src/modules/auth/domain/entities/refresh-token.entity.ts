const MAX_LIFETIME_MS = 14 * 24 * 60 * 60_000;
const IDLE_LIMIT_MS = 30 * 60_000;
const ROTATION_GRACE_MS = 10_000;

export type RefreshTokenState = 'active' | 'rotated' | 'revoked' | 'expired';

export interface RefreshTokenProps {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly rotatedAt: Date | null;
}

export class RefreshToken implements RefreshTokenProps {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly rotatedAt: Date | null;

  private constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.familyId = props.familyId;
    this.tokenHash = props.tokenHash;
    this.issuedAt = props.issuedAt;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
    this.rotatedAt = props.rotatedAt;
  }

  static issue(input: {
    id: string;
    userId: string;
    familyId: string;
    tokenHash: string;
    now: Date;
    ttlMs: number;
  }): RefreshToken {
    return new RefreshToken({
      id: input.id,
      userId: input.userId,
      familyId: input.familyId,
      tokenHash: input.tokenHash,
      issuedAt: input.now,
      expiresAt: new Date(input.now.getTime() + Math.min(input.ttlMs, MAX_LIFETIME_MS)),
      revokedAt: null,
      rotatedAt: null,
    });
  }

  static restore(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken(props);
  }

  // Using a token issues its replacement, so a token's age is the session's idle time (SEC-12).
  // Only a rotated token signals theft when replayed. Logout and password change revoke tokens
  // that a browser may still legitimately hold.
  state(now: Date): RefreshTokenState {
    if (this.revokedAt !== null && this.rotatedAt === null) return 'revoked';
    if (now >= this.expiresAt) return 'expired';
    if (this.rotatedAt !== null) return 'rotated';
    return now.getTime() - this.issuedAt.getTime() >= IDLE_LIMIT_MS ? 'expired' : 'active';
  }

  // Tabs share one cookie, so two can refresh at once. A replay this soon is treated as that.
  isInGracePeriod(now: Date): boolean {
    return this.rotatedAt !== null && now.getTime() - this.rotatedAt.getTime() < ROTATION_GRACE_MS;
  }

  rotate(input: { id: string; tokenHash: string; now: Date }): RefreshToken {
    return new RefreshToken({
      ...this,
      id: input.id,
      tokenHash: input.tokenHash,
      issuedAt: input.now,
      revokedAt: null,
      rotatedAt: null,
    });
  }

  markRotated(now: Date): RefreshToken {
    return new RefreshToken({ ...this, revokedAt: now, rotatedAt: now });
  }

  revoke(now: Date): RefreshToken {
    return new RefreshToken({ ...this, revokedAt: now });
  }
}
