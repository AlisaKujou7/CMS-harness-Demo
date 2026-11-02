import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import type { PasswordResetTokenRepository } from '../../../application/ports/out/repositories.port.js';
import { PasswordResetToken } from '../../../domain/entities/password-reset-token.entity.js';

export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly db: PrismaContext) {}

  async save(token: PasswordResetToken): Promise<void> {
    const data = { ...token };
    await this.db.client.passwordResetToken.upsert({
      where: { id: token.id },
      create: data,
      update: data,
    });
  }

  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const row = await this.db.client.passwordResetToken.findUnique({ where: { tokenHash } });
    return row && PasswordResetToken.restore(row);
  }

  async invalidateForUser(userId: string, at: Date): Promise<void> {
    await this.db.client.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: at },
    });
  }
}
