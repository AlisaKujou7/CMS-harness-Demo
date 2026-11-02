import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import type { ApiKeyRepository } from '../../../application/ports/out/repositories.port.js';
import { ApiKey } from '../../../domain/entities/api-key.entity.js';

export class PrismaApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly db: PrismaContext) {}

  async save(key: ApiKey): Promise<void> {
    const data = { ...key };
    await this.db.client.apiKey.upsert({ where: { id: key.id }, create: data, update: data });
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
}
