import { beforeEach, describe, expect, it } from 'vitest';
import {
  FakeClock,
  FakeTransactionRunner,
  InMemoryAuditLog,
  RecordingEventPublisher,
  SequentialIdGenerator,
} from '../../../../../test/fakes/system.fakes.js';
import { InMemoryUserRepository } from '../../../../../test/fakes/users.fakes.js';
import type { Actor } from '../../../../shared/kernel/actor.js';
import { ForbiddenError } from '../../../../shared/kernel/app-error.js';
import { InvalidEmailError } from '../../../../shared/kernel/email.js';
import { User, type UserProps } from '../../domain/entities/user.entity.js';
import {
  EmailTakenError,
  LastAdminError,
  UserInUseError,
  UserNotFoundError,
  UserNotInvitedError,
} from '../../domain/errors/user.errors.js';
import { assertCanManageUsers } from '../policies/user.policy.js';
import { DeactivateUser } from './deactivate-user.use-case.js';
import { DeleteUser } from './delete-user.use-case.js';
import { InviteUser } from './invite-user.use-case.js';
import { ListUsers } from './list-users.use-case.js';
import { RequestUserPasswordReset } from './request-user-password-reset.use-case.js';
import { ResendInvitation } from './resend-invitation.use-case.js';
import { UpdateUser } from './update-user.use-case.js';

const admin: Actor = { id: 'admin-1', role: 'admin' };
const nonAdmins: Actor[] = [
  { id: 'e', role: 'editor' },
  { id: 'a', role: 'author' },
];
const IP = '203.0.113.9';

const aUser = (overrides: Partial<UserProps> = {}) =>
  User.restore({
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

const anAdmin = (id = 'admin-1') =>
  aUser({ id, email: `${id}@example.com`, role: 'admin', status: 'active' });

describe('users use cases', () => {
  let users: InMemoryUserRepository;
  let audit: InMemoryAuditLog;
  let events: RecordingEventPublisher;
  let tx: FakeTransactionRunner;
  let clock: FakeClock;
  let deps: ConstructorParameters<typeof InviteUser>[0];

  beforeEach(() => {
    users = new InMemoryUserRepository();
    audit = new InMemoryAuditLog();
    events = new RecordingEventPublisher();
    tx = new FakeTransactionRunner();
    clock = new FakeClock();
    deps = { users, audit, events, tx, clock, ids: new SequentialIdGenerator() };
    users.add(anAdmin());
  });

  describe('assertCanManageUsers (FR-USER-01)', () => {
    it('allows an admin and forbids others', () => {
      expect(() => {
        assertCanManageUsers(admin);
      }).not.toThrow();
      for (const actor of nonAdmins) {
        expect(() => {
          assertCanManageUsers(actor);
        }).toThrow(ForbiddenError);
      }
    });
  });

  describe('InviteUser', () => {
    const invite = (actor: Actor = admin, email = 'New@Example.com') =>
      new InviteUser(deps).execute({ actor, email, role: 'author', name: 'New', ip: IP });

    it('creates an invited user with a normalized email', async () => {
      const result = await invite();

      expect(result).toMatchObject({
        email: 'new@example.com',
        name: 'New',
        role: 'author',
        status: 'invited',
        lastLoginAt: null,
      });
      await expect(users.findByEmail('new@example.com')).resolves.not.toBeNull();
    });

    it('allows the name to be omitted', async () => {
      const result = await new InviteUser(deps).execute({
        actor: admin,
        email: 'jo@example.com',
        role: 'editor',
        ip: IP,
      });

      expect(result.name).toBe('jo');
    });

    it('publishes UserInvited after the transaction so the email follows the commit', async () => {
      const { id } = await invite();

      expect(events.published).toEqual([
        { type: 'UserInvited', userId: id, email: 'new@example.com' },
      ]);
      expect(tx.runs).toBe(1);
    });

    it('audits the acting admin and never the email in the summary fields beyond the role', async () => {
      const { id } = await invite();

      expect(audit.events).toEqual([
        {
          actorId: 'admin-1',
          actorIp: IP,
          action: 'user.create',
          targetType: 'user',
          targetId: id,
          summary: { role: 'author' },
        },
      ]);
    });

    it('rejects an email that is already taken (FR-USER-07)', async () => {
      await invite();

      await expect(invite()).rejects.toThrow(EmailTakenError);
      expect(events.published).toHaveLength(1);
    });

    it('rejects an invalid email', async () => {
      await expect(invite(admin, 'nope')).rejects.toThrow(InvalidEmailError);
    });

    it.each(nonAdmins)('is forbidden for $role', async (actor) => {
      await expect(invite(actor)).rejects.toThrow(ForbiddenError);

      expect(users.users.size).toBe(1);
    });
  });

  describe('ListUsers (FR-USER-06)', () => {
    it('returns the fields the screen needs, paged', async () => {
      const login = new Date('2026-02-01T00:00:00Z');
      users.add(aUser({ lastLoginAt: login }));

      const result = await new ListUsers(deps).execute({ actor: admin, page: 2, pageSize: 1 });

      expect(result).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
      expect(result.items).toEqual([
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Someone',
          role: 'editor',
          status: 'active',
          lastLoginAt: login,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);
    });

    it('defaults to the first page', async () => {
      const result = await new ListUsers(deps).execute({ actor: admin });

      expect(result).toMatchObject({ page: 1, pageSize: 25 });
    });

    it.each(nonAdmins)('is forbidden for $role', async (actor) => {
      await expect(new ListUsers(deps).execute({ actor })).rejects.toThrow(ForbiddenError);
    });
  });

  describe('UpdateUser (UR-A02)', () => {
    const update = (changes: { name?: string; role?: Actor['role'] }, actor: Actor = admin) =>
      new UpdateUser(deps).execute({ actor, id: 'user-1', ip: IP, ...changes });

    beforeEach(() => {
      users.add(aUser());
    });

    it('changes the role and audits both values', async () => {
      const result = await update({ role: 'author' });

      expect(result.role).toBe('author');
      expect(audit.events).toEqual([
        {
          actorId: 'admin-1',
          actorIp: IP,
          action: 'user.update',
          targetType: 'user',
          targetId: 'user-1',
          summary: { role: { from: 'editor', to: 'author' } },
        },
      ]);
    });

    it('changes the name and audits both values', async () => {
      const result = await update({ name: 'Renamed' });

      expect(result.name).toBe('Renamed');
      expect(audit.events[0]?.summary).toEqual({ name: { from: 'Someone', to: 'Renamed' } });
    });

    it('writes nothing when no value changes', async () => {
      await update({ name: 'Someone', role: 'editor' });

      expect(audit.events).toEqual([]);
      expect(users.users.get('user-1')?.updatedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    });

    it('stamps the change time', async () => {
      await update({ role: 'author' });

      expect(users.users.get('user-1')?.updatedAt).toEqual(clock.now());
    });

    it('reports a missing user', async () => {
      await expect(
        new UpdateUser(deps).execute({ actor: admin, id: 'nope', role: 'author', ip: IP }),
      ).rejects.toThrow(UserNotFoundError);
    });

    it('refuses to demote the last admin', async () => {
      await expect(
        new UpdateUser(deps).execute({ actor: admin, id: 'admin-1', role: 'editor', ip: IP }),
      ).rejects.toThrow(LastAdminError);
    });

    it('allows demoting an admin while another remains', async () => {
      users.add(anAdmin('admin-2'));

      const result = await new UpdateUser(deps).execute({
        actor: admin,
        id: 'admin-2',
        role: 'editor',
        ip: IP,
      });

      expect(result.role).toBe('editor');
    });

    it('allows renaming the last admin', async () => {
      const result = await new UpdateUser(deps).execute({
        actor: admin,
        id: 'admin-1',
        name: 'Boss',
        ip: IP,
      });

      expect(result.name).toBe('Boss');
    });

    it('allows promoting a user when there is only one admin', async () => {
      await expect(update({ role: 'admin' })).resolves.toMatchObject({ role: 'admin' });
    });

    it('allows setting the last admin role to admin again', async () => {
      await expect(
        new UpdateUser(deps).execute({ actor: admin, id: 'admin-1', role: 'admin', ip: IP }),
      ).resolves.toMatchObject({ role: 'admin' });
    });

    it.each(nonAdmins)('is forbidden for $role', async (actor) => {
      await expect(update({ role: 'admin' }, actor)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('DeactivateUser (UR-A03, FR-USER-05)', () => {
    const deactivate = (id = 'user-1', actor: Actor = admin) =>
      new DeactivateUser(deps).execute({ actor, id, ip: IP });

    beforeEach(() => {
      users.add(aUser());
    });

    it('deactivates, audits, and publishes UserDeactivated', async () => {
      await deactivate();

      expect(users.users.get('user-1')?.status).toBe('deactivated');
      expect(audit.actions()).toEqual(['user.deactivate']);
      expect(audit.events[0]).toMatchObject({ actorId: 'admin-1', targetId: 'user-1' });
      expect(events.published).toEqual([{ type: 'UserDeactivated', userId: 'user-1' }]);
    });

    it('does nothing more when the user is already deactivated', async () => {
      await deactivate();
      await deactivate();

      expect(audit.events).toHaveLength(1);
      expect(events.published).toHaveLength(1);
    });

    it('refuses to deactivate the last admin', async () => {
      await expect(deactivate('admin-1')).rejects.toThrow(LastAdminError);
    });

    it('allows deactivating an admin while another remains', async () => {
      users.add(anAdmin('admin-2'));

      await deactivate('admin-2');

      expect(users.users.get('admin-2')?.status).toBe('deactivated');
    });

    it('reports a missing user', async () => {
      await expect(deactivate('nope')).rejects.toThrow(UserNotFoundError);
    });

    it.each(nonAdmins)('is forbidden for $role', async (actor) => {
      await expect(deactivate('user-1', actor)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('DeleteUser (FR-USER-04)', () => {
    const remove = (id = 'user-1', actor: Actor = admin) =>
      new DeleteUser(deps).execute({ actor, id, ip: IP });

    beforeEach(() => {
      users.add(aUser());
    });

    it('deletes and audits', async () => {
      await remove();

      expect(users.users.has('user-1')).toBe(false);
      expect(audit.events[0]).toMatchObject({
        actorId: 'admin-1',
        action: 'user.delete',
        targetId: 'user-1',
      });
    });

    it('refuses to delete the last admin', async () => {
      await expect(remove('admin-1')).rejects.toThrow(LastAdminError);

      expect(users.users.has('admin-1')).toBe(true);
    });

    it('allows deleting an admin while another remains', async () => {
      users.add(anAdmin('admin-2'));

      await remove('admin-2');

      expect(users.users.has('admin-2')).toBe(false);
    });

    it('reports a user still referenced by other records', async () => {
      users.inUse.add('user-1');

      await expect(remove()).rejects.toThrow(UserInUseError);
    });

    it('reports a missing user', async () => {
      await expect(remove('nope')).rejects.toThrow(UserNotFoundError);
    });

    it.each(nonAdmins)('is forbidden for $role', async (actor) => {
      await expect(remove('user-1', actor)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('RequestUserPasswordReset (UR-A05)', () => {
    const reset = (actor: Actor = admin, id = 'user-1') =>
      new RequestUserPasswordReset(deps).execute({ actor, id, ip: IP });

    beforeEach(() => {
      users.add(aUser());
    });

    it('audits the admin and publishes a reset request for the user', async () => {
      await reset();

      expect(audit.events[0]).toMatchObject({
        actorId: 'admin-1',
        action: 'user.password_reset_requested',
        targetId: 'user-1',
      });
      expect(events.published).toEqual([
        { type: 'UserPasswordResetRequested', email: 'user@example.com', ip: IP },
      ]);
    });

    it('reports a missing user', async () => {
      await expect(reset(admin, 'nope')).rejects.toThrow(UserNotFoundError);
    });

    it.each(nonAdmins)('is forbidden for $role', async (actor) => {
      await expect(reset(actor)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('ResendInvitation', () => {
    const resend = (actor: Actor = admin, id = 'user-1') =>
      new ResendInvitation(deps).execute({ actor, id, ip: IP });

    it('publishes UserInvited again and audits it', async () => {
      users.add(aUser({ status: 'invited' }));

      await resend();

      expect(events.published).toEqual([
        { type: 'UserInvited', userId: 'user-1', email: 'user@example.com' },
      ]);
      expect(audit.actions()).toEqual(['user.invitation_resent']);
    });

    it('refuses a user who already accepted', async () => {
      users.add(aUser({ status: 'active' }));

      await expect(resend()).rejects.toThrow(UserNotInvitedError);
      expect(events.published).toEqual([]);
    });

    it('reports a missing user', async () => {
      await expect(resend(admin, 'nope')).rejects.toThrow(UserNotFoundError);
    });

    it.each(nonAdmins)('is forbidden for $role', async (actor) => {
      await expect(resend(actor)).rejects.toThrow(ForbiddenError);
    });
  });
});
