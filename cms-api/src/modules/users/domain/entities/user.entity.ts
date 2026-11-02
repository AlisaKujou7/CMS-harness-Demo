import type { UserRole } from '../../../../shared/kernel/actor.js';
import type { Email } from '../../../../shared/kernel/email.js';
import { InvalidUserNameError } from '../errors/user.errors.js';

const MAX_NAME_LENGTH = 200;

export type UserStatus = 'active' | 'deactivated' | 'invited';

export interface UserProps {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function validName(input: string): string {
  const name = input.trim();
  if (name === '' || name.length > MAX_NAME_LENGTH) throw new InvalidUserNameError();
  return name;
}

export class User implements UserProps {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.role = props.role;
    this.status = props.status;
    this.lastLoginAt = props.lastLoginAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static invite(input: {
    id: string;
    email: Email;
    name?: string;
    role: UserRole;
    now: Date;
  }): User {
    return new User({
      id: input.id,
      email: input.email.value,
      name: validName(input.name ?? input.email.value.slice(0, input.email.value.indexOf('@'))),
      role: input.role,
      status: 'invited',
      lastLoginAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: UserProps): User {
    return new User(props);
  }

  isActiveAdmin(): boolean {
    return this.role === 'admin' && this.status === 'active';
  }

  isInvited(): boolean {
    return this.status === 'invited';
  }

  isDeactivated(): boolean {
    return this.status === 'deactivated';
  }

  rename(name: string, now: Date): User {
    return new User({ ...this, name: validName(name), updatedAt: now });
  }

  changeRole(role: UserRole, now: Date): User {
    return new User({ ...this, role, updatedAt: now });
  }

  deactivate(now: Date): User {
    return new User({ ...this, status: 'deactivated', updatedAt: now });
  }
}
