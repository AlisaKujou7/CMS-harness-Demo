import { describe, expect, it } from 'vitest';
import { Email } from '../../../shared/kernel/email.js';
import { User } from './entities/user.entity.js';
import {
  EmailTakenError,
  InvalidUserNameError,
  LastAdminError,
  UserInUseError,
  UserNotActiveError,
  UserNotFoundError,
  UserNotInvitedError,
} from './errors/user.errors.js';

const T0 = new Date('2026-05-11T10:00:00Z');
const T1 = new Date('2026-05-11T11:00:00Z');

const invite = (name?: string) =>
  User.invite({
    id: 'u1',
    email: Email.create('new.person@example.com'),
    role: 'author',
    now: T0,
    ...(name === undefined ? {} : { name }),
  });

describe('User.invite', () => {
  it('starts invited with no login and a fresh timestamp', () => {
    const user = invite('New Person');

    expect(user).toMatchObject({
      id: 'u1',
      email: 'new.person@example.com',
      name: 'New Person',
      role: 'author',
      status: 'invited',
      lastLoginAt: null,
      createdAt: T0,
      updatedAt: T0,
    });
  });

  it('falls back to the part of the email before the @ when no name is given', () => {
    expect(invite().name).toBe('new.person');
  });

  it('trims the name', () => {
    expect(invite('  Ann  ').name).toBe('Ann');
  });

  it.each(['', '   ', 'x'.repeat(201)])('rejects the name "%s"', (name) => {
    expect(() => invite(name)).toThrow(InvalidUserNameError);
  });

  it('accepts a name of exactly 200 characters', () => {
    expect(invite('x'.repeat(200)).name).toHaveLength(200);
  });
});

describe('User changes', () => {
  it('renames and stamps the change without touching the original', () => {
    const user = invite('Ann');

    const renamed = user.rename(' Bea ', T1);

    expect(renamed.name).toBe('Bea');
    expect(renamed.updatedAt).toEqual(T1);
    expect(user.name).toBe('Ann');
  });

  it('rejects an invalid new name', () => {
    expect(() => invite('Ann').rename(' ', T1)).toThrow(InvalidUserNameError);
  });

  it('changes role', () => {
    const changed = invite('Ann').changeRole('editor', T1);

    expect(changed.role).toBe('editor');
    expect(changed.updatedAt).toEqual(T1);
  });

  it('deactivates', () => {
    const user = invite('Ann').deactivate(T1);

    expect(user.status).toBe('deactivated');
    expect(user.updatedAt).toEqual(T1);
  });
});

describe('User state questions', () => {
  const restored = (role: 'admin' | 'editor', status: 'active' | 'invited' | 'deactivated') =>
    User.restore({ ...invite('Ann'), role, status });

  it('is an active admin only when both the role and status match', () => {
    expect(restored('admin', 'active').isActiveAdmin()).toBe(true);
    expect(restored('admin', 'deactivated').isActiveAdmin()).toBe(false);
    expect(restored('editor', 'active').isActiveAdmin()).toBe(false);
  });

  it('knows whether it is still invited', () => {
    expect(restored('editor', 'invited').isInvited()).toBe(true);
    expect(restored('editor', 'active').isInvited()).toBe(false);
  });

  it('knows whether it is active', () => {
    expect(restored('editor', 'active').isActive()).toBe(true);
    expect(restored('editor', 'invited').isActive()).toBe(false);
  });

  it('knows whether it is deactivated', () => {
    expect(restored('editor', 'deactivated').isDeactivated()).toBe(true);
    expect(restored('editor', 'active').isDeactivated()).toBe(false);
  });
});

describe('user errors', () => {
  it.each([
    [new UserNotFoundError(), 'not_found', 'NOT_FOUND'],
    [new EmailTakenError(), 'conflict', 'EMAIL_TAKEN'],
    [new LastAdminError(), 'conflict', 'LAST_ADMIN'],
    [new UserInUseError(), 'conflict', 'USER_IN_USE'],
    [new UserNotInvitedError(), 'conflict', 'USER_NOT_INVITED'],
    [new UserNotActiveError(), 'conflict', 'USER_NOT_ACTIVE'],
    [new InvalidUserNameError(), 'validation', 'VALIDATION_ERROR'],
  ])('%o maps to the right kind and code', (error, kind, code) => {
    expect(error.kind).toBe(kind);
    expect(error.code).toBe(code);
  });

  it('names the field for a taken email and an invalid name', () => {
    expect(new EmailTakenError().details).toEqual({ field: 'email' });
    expect(new InvalidUserNameError().details).toEqual({ field: 'name' });
  });
});
