const MAX_LIFETIME_MS = 14 * 24 * 60 * 60_000;
const IDLE_LIMIT_MS = 30 * 60_000;

export type RefreshTokenState = 'active' | 'revoked' | 'expired';

export interface RefreshTokenProps {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export class RefreshToken implements RefreshTokenProps {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;

  private constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.familyId = props.familyId;
    this.tokenHash = props.tokenHash;
    this.issuedAt = props.issuedAt;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
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
    });
  }

  static restore(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken(props);
  }

  // Using a token issues its replacement, so a token's age is the session's idle time (SEC-12).
  state(now: Date): RefreshTokenState {
    if (this.revokedAt !== null) return 'revoked';
    const idle = now.getTime() - this.issuedAt.getTime() >= IDLE_LIMIT_MS;
    return idle || now >= this.expiresAt ? 'expired' : 'active';
  }

  rotate(input: { id: string; tokenHash: string; now: Date }): RefreshToken {
    return new RefreshToken({
      ...this,
      id: input.id,
      tokenHash: input.tokenHash,
      issuedAt: input.now,
      revokedAt: null,
    });
  }

  revoke(now: Date): RefreshToken {
    return new RefreshToken({ ...this, revokedAt: now });
  }
}
