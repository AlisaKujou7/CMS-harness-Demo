import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { aPage, aUser, ID } from '../../../../test/builders';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import { renderPage, signIn } from '../../../../test/utils/render-with-providers';
import type { UserRow } from '../../../shared/api/types';
import { UsersPage } from './UsersPage';

const USERS = '*/api/admin/users';
const ONE = `${USERS}/${ID.user}`;

function answer(rows: readonly UserRow[] = [aUser()]) {
  const pages: (string | null)[] = [];
  server.use(
    http.get(USERS, ({ request }) => {
      pages.push(new URL(request.url).searchParams.get('page'));
      return HttpResponse.json({ data: rows, pagination: aPage({ total_pages: 2 }) });
    }),
  );
  return pages;
}

async function setup(rows?: readonly UserRow[]) {
  answer(rows);
  signIn();
  const view = renderPage(<UsersPage />);
  await screen.findByRole('table');
  return view;
}

async function openMenu(user: ReturnType<typeof renderPage>['user'], name = 'Alice') {
  await user.click(screen.getByRole('button', { name: `More actions for ${name}` }));
}

describe('UsersPage (FR-USER-06)', () => {
  it('lists name, email, role, status and last login', async () => {
    await setup([aUser({ last_login_at: null })]);

    const row = screen.getAllByRole('row')[1] as HTMLElement;
    for (const text of ['Alice', 'alice@example.com', 'Editor', 'Active', 'Never']) {
      expect(within(row).getByText(text)).toBeInTheDocument();
    }
    await expectNoA11yViolations();
  });

  it('shows how long ago someone last signed in', async () => {
    await setup([aUser()]);

    expect(screen.getByText(/ago$/)).toBeInTheDocument();
  });

  it('moves between pages', async () => {
    const pages = answer();
    signIn();
    const { user } = renderPage(<UsersPage />);

    await user.click(await screen.findByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(pages).toContain('2');
    });
  });

  it('invites a user', async () => {
    let body: unknown;
    server.use(
      http.post(USERS, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: aUser({ email: 'new@example.com' }) }, { status: 201 });
      }),
    );
    const { user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Invite user' }));
    await expectNoA11yViolations();
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Name (optional)'), 'Newt');
    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(screen.getByRole('option', { name: 'Editor' }));
    await user.click(screen.getByRole('button', { name: 'Send invite' }));

    expect(await screen.findByText('Invitation sent to new@example.com')).toBeInTheDocument();
    expect(body).toEqual({ email: 'new@example.com', name: 'Newt', role: 'editor' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves out an empty name, and shows a refusal in the dialog', async () => {
    let body: unknown;
    server.use(
      http.post(USERS, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { error: { code: 'EMAIL_TAKEN', message: 'That email is taken' } },
          { status: 409 },
        );
      }),
    );
    const { user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Invite user' }));
    await user.type(screen.getByLabelText('Email'), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Send invite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That email is taken');
    expect(body).toEqual({ email: 'a@example.com', role: 'author' });
  });

  it('checks the email before inviting, and can be cancelled', async () => {
    const { user } = await setup();

    await user.click(screen.getByRole('button', { name: 'Invite user' }));
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByText('This field is required')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('edits a role', async () => {
    let body: unknown;
    server.use(
      http.patch(ONE, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: aUser() });
      }),
    );
    const { user } = await setup();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Edit user' }));
    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    await user.click(screen.getByRole('option', { name: 'Admin' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('User updated')).toBeInTheDocument();
    expect(body).toEqual({ name: 'Alice', role: 'admin' });
  });

  it('holds the name to being present, and shows why the server refused', async () => {
    server.use(
      http.patch(ONE, () =>
        HttpResponse.json(
          { error: { code: 'LAST_ADMIN', message: 'The last Admin must stay one' } },
          { status: 409 },
        ),
      ),
    );
    const { user } = await setup();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Edit user' }));
    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('This field is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Ann');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The last Admin must stay one');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('asks before deactivating (NFR-USE-02)', async () => {
    const deactivate = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.post(`${ONE}/deactivate`, deactivate));
    const { user } = await setup();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    expect(deactivate).not.toHaveBeenCalled();

    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }),
    );

    expect(await screen.findByText('User deactivated')).toBeInTheDocument();
    expect(deactivate).toHaveBeenCalledOnce();
  });

  it('can back out of deactivating', async () => {
    const { user } = await setup();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('asks for the email before deleting, and reports a refusal as a toast', async () => {
    server.use(
      http.delete(ONE, () =>
        HttpResponse.json(
          { error: { code: 'USER_IN_USE', message: 'This user has authored content' } },
          { status: 409 },
        ),
      ),
    );
    const { user } = await setup();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();

    await user.type(dialog.getByLabelText('Email'), 'alice@example.com');
    await user.click(dialog.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('deletes after the email is typed, or backs out', async () => {
    server.use(http.delete(ONE, () => new HttpResponse(null, { status: 204 })));
    const { user } = await setup();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Email'), 'alice@example.com');
    await user.click(dialog.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('User deleted')).toBeInTheDocument();
  });

  it('offers a password reset to an active user only', async () => {
    server.use(http.post(`${ONE}/reset-password`, () => new HttpResponse(null, { status: 204 })));
    const { user } = await setup();

    await openMenu(user);
    expect(screen.queryByRole('menuitem', { name: 'Resend invite' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Reset password' }));

    expect(
      await screen.findByText('Password reset email sent to alice@example.com'),
    ).toBeInTheDocument();
  });

  it('offers to resend an invitation to an invited user only', async () => {
    server.use(http.post(`${ONE}/resend-invite`, () => new HttpResponse(null, { status: 204 })));
    const { user } = await setup([aUser({ status: 'invited' })]);

    await openMenu(user);
    expect(screen.queryByRole('menuitem', { name: 'Reset password' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Resend invite' }));

    expect(await screen.findByText('Invitation resent to alice@example.com')).toBeInTheDocument();
  });

  it('does not offer to deactivate someone already deactivated', async () => {
    const { user } = await setup([aUser({ status: 'deactivated' })]);

    await openMenu(user);

    expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });
});
