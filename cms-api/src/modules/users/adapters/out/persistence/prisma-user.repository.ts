import { Prisma, type User as UserRow } from '../../../../../generated/prisma/client.js';
import type { PrismaContext } from '../../../../../shared/adapters/out/prisma-context.js';
import {
  pagedResult,
  type PagedResult,
  type PageRequest,
} from '../../../../../shared/kernel/paged-result.js';
import type {
  UserChanges,
  UserRepository,
} from '../../../application/ports/out/user-repository.port.js';
import { User } from '../../../domain/entities/user.entity.js';
import { EmailTakenError, UserInUseError } from '../../../domain/errors/user.errors.js';

const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function toDomain(row: UserRow): User {
  return User.restore({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaContext) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.client.user.findUnique({ where: { id } });
    return row && toDomain(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.client.user.findUnique({ where: { email } });
    return row && toDomain(row);
  }

  async findMany(page: PageRequest): Promise<PagedResult<User>> {
    const [rows, total] = await Promise.all([
      this.db.client.user.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.db.client.user.count(),
    ]);
    return pagedResult(rows.map(toDomain), total, page);
  }

  async create(user: User): Promise<void> {
    try {
      await this.db.client.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      throw hasCode(error, UNIQUE_VIOLATION) ? new EmailTakenError() : error;
    }
  }

  async update(id: string, changes: UserChanges): Promise<void> {
    await this.db.client.user.update({ where: { id }, data: changes });
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.client.user.delete({ where: { id } });
    } catch (error) {
      throw hasCode(error, FOREIGN_KEY_VIOLATION) ? new UserInUseError() : error;
    }
  }

  async lockActiveAdminIds(): Promise<readonly string[]> {
    const rows = await this.db.client.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE role = 'admin' AND status = 'active' FOR UPDATE
    `;
    return rows.map((row) => row.id);
  }
}
