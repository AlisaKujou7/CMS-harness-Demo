import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { PasswordHasher } from '../../../application/ports/out/security.port.js';

export interface Argon2Cost {
  readonly memoryKb: number;
  readonly iterations: number;
  readonly parallelism: number;
}

export class Argon2PasswordHasher implements PasswordHasher {
  private decoy: Promise<string> | undefined;

  constructor(private readonly cost: Argon2Cost) {}

  hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.cost.memoryKb,
      timeCost: this.cost.iterations,
      parallelism: this.cost.parallelism,
    });
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  async verifyAgainstNothing(password: string): Promise<void> {
    this.decoy ??= this.hash(randomBytes(32).toString('hex'));
    await this.verify(await this.decoy, password);
  }
}
