const LIFETIME_MS = 60 * 60_000;

export interface PasswordResetTokenProps {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
}

export class PasswordResetToken implements PasswordResetTokenProps {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;

  private constructor(props: PasswordResetTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.usedAt = props.usedAt;
  }

  static issue(input: {
    id: string;
    userId: string;
    tokenHash: string;
    now: Date;
  }): PasswordResetToken {
    return new PasswordResetToken({
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.now.getTime() + LIFETIME_MS),
      usedAt: null,
    });
  }

  static restore(props: PasswordResetTokenProps): PasswordResetToken {
    return new PasswordResetToken(props);
  }

  isUsable(now: Date): boolean {
    return this.usedAt === null && now < this.expiresAt;
  }
}
