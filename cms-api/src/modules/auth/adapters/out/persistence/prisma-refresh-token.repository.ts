import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import type { RefreshTokenRepository } from '../../../application/ports/out/repositories.port.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: PrismaContext) {}

  async save(token: RefreshToken): Promise<void> {
    await this.db.client.refreshToken.create({ data: { ...token } });
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const row = await this.db.client.refreshToken.findUnique({ where: { tokenHash } });
    return row && RefreshToken.restore(row);
  }

  // Conditional updates, so only one concurrent caller can win.
  async markRotatedIfActive(id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.client.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at, rotatedAt: at },
    });
    return count === 1;
  }

  async revokeIfActive(id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.client.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at },
    });
    return count === 1;
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    await this.db.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}
