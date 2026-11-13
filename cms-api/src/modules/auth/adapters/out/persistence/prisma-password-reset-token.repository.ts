import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import type { PasswordResetTokenRepository } from '../../../application/ports/out/repositories.port.js';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token.entity.js';

export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly db: PrismaContext) {}

  async save(token: PasswordResetToken): Promise<void> {
    await this.db.client.passwordResetToken.create({ data: { ...token } });
  }

  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const row = await this.db.client.passwordResetToken.findUnique({ where: { tokenHash } });
    return row && PasswordResetToken.restore(row);
  }

  async consumeIfUnused(id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.client.passwordResetToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: at },
    });
    return count === 1;
  }

  async invalidateForUser(userId: string, at: Date): Promise<void> {
    await this.db.client.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: at },
    });
  }

  async deleteExpiredBefore(cutoff: Date): Promise<number> {
    const { count } = await this.db.client.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return count;
  }
}
