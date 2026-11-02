import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import type { LoginLockoutRepository } from '../../../application/ports/out/repositories.port.js';
import { LoginLockout } from '../../../domain/services/login-lockout.js';

export class PrismaLoginLockoutRepository implements LoginLockoutRepository {
  constructor(private readonly db: PrismaContext) {}

  async find(userId: string): Promise<LoginLockout> {
    const row = await this.db.client.loginLockout.findUnique({ where: { userId } });
    return row ? LoginLockout.restore(row) : LoginLockout.none();
  }

  async save(userId: string, lockout: LoginLockout): Promise<void> {
    const state = {
      failureCount: lockout.failureCount,
      windowStartedAt: lockout.windowStartedAt,
      lockedUntil: lockout.lockedUntil,
    };
    await this.db.client.loginLockout.upsert({
      where: { userId },
      create: { userId, ...state },
      update: state,
    });
  }

  async clear(userId: string): Promise<void> {
    await this.db.client.loginLockout.deleteMany({ where: { userId } });
  }
}
