import type { UserRole } from '../../../../shared/kernel/actor.js';

export type AccountStatus = 'active' | 'deactivated' | 'invited';

export interface AccountProps {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly passwordHash: string | null;
  readonly status: AccountStatus;
}

// The authentication view of a user. The users module owns the user lifecycle.
export class Account implements AccountProps {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly passwordHash: string | null;
  readonly status: AccountStatus;

  constructor(props: AccountProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.role = props.role;
    this.passwordHash = props.passwordHash;
    this.status = props.status;
  }

  canLogin(): boolean {
    return this.status === 'active' && this.passwordHash !== null;
  }
}
