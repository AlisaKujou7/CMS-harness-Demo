import { type JWTPayload, jwtVerify, SignJWT } from 'jose';
import type { UserRole } from '../../../../../shared/kernel/actor.js';
import type { Clock } from '../../../../../shared/ports/system.port.js';
import type {
  AccessTokenClaims,
  AccessTokenSigner,
} from '../../../application/ports/out/security.port.js';

const ALGORITHM = 'HS256';
const ISSUER = 'cms';
const AUDIENCE = 'cms-admin';
const ROLES: readonly unknown[] = ['admin', 'editor', 'author'] satisfies UserRole[];

function isRole(value: unknown): value is UserRole {
  return ROLES.includes(value);
}

function toClaims(payload: JWTPayload): AccessTokenClaims | null {
  const role = payload['role'];
  return payload.sub !== undefined && isRole(role) ? { userId: payload.sub, role } : null;
}

export class JoseAccessTokenSigner implements AccessTokenSigner {
  private readonly signingKey: Uint8Array;
  private readonly keys: readonly Uint8Array[];

  // The first secret signs. Later ones only verify, which is what lets a secret rotate without
  // signing everyone out (07-OPS-ARCH 8.4).
  constructor(
    secrets: readonly [string, ...string[]],
    private readonly clock: Clock,
  ) {
    const encoder = new TextEncoder();
    this.signingKey = encoder.encode(secrets[0]);
    this.keys = secrets.map((secret) => encoder.encode(secret));
  }

  async sign(claims: AccessTokenClaims, ttlSeconds: number): Promise<string> {
    const nowSeconds = Math.floor(this.clock.now().getTime() / 1000);
    return new SignJWT({ role: claims.role })
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + ttlSeconds)
      .sign(this.signingKey);
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    for (const key of this.keys) {
      const payload = await this.verifyWith(token, key);
      if (payload) return toClaims(payload);
    }
    return null;
  }

  private async verifyWith(token: string, key: Uint8Array): Promise<JWTPayload | null> {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
        currentDate: this.clock.now(),
      });
      return payload;
    } catch {
      return null;
    }
  }
}
