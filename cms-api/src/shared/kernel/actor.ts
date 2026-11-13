export type UserRole = 'admin' | 'editor' | 'author';

export interface Actor {
  readonly id: string;
  readonly role: UserRole;
}

export function canManageSystem(actor: Actor): boolean {
  return actor.role === 'admin';
}
