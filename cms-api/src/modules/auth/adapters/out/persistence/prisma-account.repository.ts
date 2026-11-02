import type { User } from '../../../../../generated/prisma/client.js';
import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import type { AccountRepository } from '../../../application/ports/out/repositories.port.js';
import { Account } from '../../../domain/entities/account.entity.js';

function toDomain(row: User): Account {
  return new Account({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.passwordHash,
    status: row.status,
  });
}

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly db: PrismaContext) {}

  async findByEmail(email: string): Promise<Account | null> {
    const row = await this.db.client.user.findUnique({ where: { email } });
    return row && toDomain(row);
  }

  async findById(id: string): Promise<Account | null> {
    const row = await this.db.client.user.findUnique({ where: { id } });
    return row && toDomain(row);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db.client.user.update({ where: { id }, data: { passwordHash } });
  }

  async activate(id: string, passwordHash: string): Promise<void> {
    await this.db.client.user.update({ where: { id }, data: { passwordHash, status: 'active' } });
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    await this.db.client.user.update({ where: { id }, data: { lastLoginAt: at } });
  }
}
