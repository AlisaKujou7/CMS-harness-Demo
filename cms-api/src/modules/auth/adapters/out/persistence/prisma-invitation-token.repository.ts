import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import type { InvitationTokenRepository } from '../../../application/ports/out/repositories.port.js';
import { InvitationToken } from '../../../domain/entities/invitation-token.entity.js';

export class PrismaInvitationTokenRepository implements InvitationTokenRepository {
  constructor(private readonly db: PrismaContext) {}

  async save(token: InvitationToken): Promise<void> {
    await this.db.client.invitationToken.create({ data: { ...token } });
  }

  async findByHash(tokenHash: string): Promise<InvitationToken | null> {
    const row = await this.db.client.invitationToken.findUnique({ where: { tokenHash } });
    return row && InvitationToken.restore(row);
  }

  async consumeIfUnused(id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.client.invitationToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: at },
    });
    return count === 1;
  }

  async invalidateForUser(userId: string, at: Date): Promise<void> {
    await this.db.client.invitationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: at },
    });
  }

  async deleteExpiredBefore(cutoff: Date): Promise<number> {
    const { count } = await this.db.client.invitationToken.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return count;
  }
}
