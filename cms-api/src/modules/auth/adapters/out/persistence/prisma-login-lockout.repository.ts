import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import type { LoginLockoutRepository } from '../../../application/ports/out/repositories.port.js';
import { LoginLockout } from '../../../domain/services/login-lockout.js';

export class PrismaLoginLockoutRepository implements LoginLockoutRepository {
  constructor(private readonly db: PrismaContext) {}

  async find(userId: string): Promise<LoginLockout> {
    const row = await this.db.client.loginLockout.findUnique({ where: { userId } });
    return row ? LoginLockout.restore(row) : LoginLockout.none();
  }

  // The row must exist before it can be locked, so a first attempt creates it.
  async findForUpdate(userId: string): Promise<LoginLockout> {
    const { client } = this.db;
    await client.$executeRaw`
      INSERT INTO login_lockouts (user_id, failure_times)
      VALUES (${userId}::uuid, '{}')
      ON CONFLICT (user_id) DO NOTHING
    `;
    await client.$queryRaw`SELECT 1 FROM login_lockouts WHERE user_id = ${userId}::uuid FOR UPDATE`;
    return this.find(userId);
  }

  async save(userId: string, lockout: LoginLockout): Promise<void> {
    const state = { failureTimes: [...lockout.failureTimes], lockedUntil: lockout.lockedUntil };
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
