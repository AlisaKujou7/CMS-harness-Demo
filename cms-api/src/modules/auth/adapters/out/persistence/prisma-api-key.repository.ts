import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import type { ApiKeyRepository } from '../../../application/ports/out/repositories.port.js';
import { ApiKey } from '../../../domain/entities/api-key.entity.js';

export class PrismaApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly db: PrismaContext) {}

  async save(key: ApiKey): Promise<void> {
    await this.db.client.apiKey.create({ data: { ...key } });
  }

  async findById(id: string): Promise<ApiKey | null> {
    const row = await this.db.client.apiKey.findUnique({ where: { id } });
    return row && ApiKey.restore(row);
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const row = await this.db.client.apiKey.findUnique({ where: { keyHash } });
    return row && ApiKey.restore(row);
  }

  async findAll(): Promise<readonly ApiKey[]> {
    const rows = await this.db.client.apiKey.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ApiKey.restore(row));
  }

  // Conditional single-column writes, so neither can overwrite the other from a stale read.
  async touchLastUsed(id: string, at: Date): Promise<void> {
    await this.db.client.apiKey.updateMany({
      where: { id, revokedAt: null },
      data: { lastUsedAt: at },
    });
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.db.client.apiKey.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}
