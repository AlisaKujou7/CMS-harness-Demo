import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import { anAdmin, renderPage, signIn } from '../../../../test/utils/render-with-providers';
import { useSessionStore } from '../../../shared/stores/session.store';
import { useUiStore } from '../../../shared/stores/ui.store';
import { ProfilePage } from './ProfilePage';

const CHANGE = '*/api/admin/auth/password/change';
const GOOD = 'correct-horse-1';

function setup() {
  signIn();
  return renderPage(<ProfilePage />);
}

async function fill(user: ReturnType<typeof renderPage>['user'], confirm = GOOD) {
  await user.type(screen.getByLabelText('Current password'), 'old-password-1');
  await user.type(screen.getByLabelText('New password'), GOOD);
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

describe('ProfilePage (03-DESIGN 12.9)', () => {
  it('shows the account', async () => {
    setup();

    expect(screen.getByText(anAdmin.email)).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('changes the theme', async () => {
    const { user } = setup();
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(useUiStore.getState().themeMode).toBe('dark');
  });

  it('changes the password, and signs out because every session ended (FR-AUTH-05)', async () => {
    let body: unknown;
    server.use(
      http.post(CHANGE, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = setup();

    await fill(user);

    await waitFor(() => {
      expect(useSessionStore.getState().status).toBe('anonymous');
    });
    expect(body).toEqual({ current_password: 'old-password-1', new_password: GOOD });
    expect(await screen.findByRole('status')).toHaveTextContent('Password changed');
  });

  it('marks the current password when it is wrong', async () => {
    server.use(
      http.post(CHANGE, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Current password is incorrect',
              details: { field: 'currentPassword' },
            },
          },
          { status: 422 },
        ),
      ),
    );
    const { user } = setup();

    await fill(user);

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks the new password when the policy refuses it', async () => {
    server.use(
      http.post(CHANGE, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Too common',
              details: { field: 'newPassword' },
            },
          },
          { status: 422 },
        ),
      ),
    );
    const { user } = setup();

    await fill(user);

    expect(await screen.findByText('Too common')).toBeInTheDocument();
  });

  it('shows any other failure above the form', async () => {
    server.use(http.post(CHANGE, () => new HttpResponse(null, { status: 429 })));
    const { user } = setup();

    await fill(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
  });

  it('checks the fields first', async () => {
    const { user } = setup();

    await fill(user, 'different');

    expect(await screen.findByText('The passwords do not match')).toBeInTheDocument();
  });
});
