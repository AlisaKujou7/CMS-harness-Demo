import type { UserRole } from '../../../../../shared/kernel/actor.js';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
  // Does the work of a verification with no account, so response time does not reveal which
  // emails exist.
  verifyAgainstNothing(password: string): Promise<void>;
}

export interface AccessTokenClaims {
  readonly userId: string;
  readonly role: UserRole;
}

export interface AccessTokenSigner {
  sign(claims: AccessTokenClaims, ttlSeconds: number): Promise<string>;
  verify(token: string): Promise<AccessTokenClaims | null>;
}

export interface OpaqueTokenService {
  generate(): string;
  hash(token: string): string;
}
