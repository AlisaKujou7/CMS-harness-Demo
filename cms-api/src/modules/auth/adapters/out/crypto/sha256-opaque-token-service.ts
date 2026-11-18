import { createHash, randomBytes } from 'node:crypto';
import type { OpaqueTokenService } from '../../../application/ports/out/security.port.js';

const TOKEN_BYTES = 32;

// SHA-256 is enough here: unlike passwords, these tokens have 256 bits of entropy.
export class Sha256OpaqueTokenService implements OpaqueTokenService {
  generate(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
