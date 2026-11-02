import { User, type UserProps } from '../../src/modules/users/domain/entities/user.entity.js';

export function aUser(overrides: Partial<UserProps> = {}): User {
  return User.restore({
    id: 'user-1',
    email: 'user@example.com',
    name: 'Someone',
    role: 'editor',
    status: 'active',
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });
}
