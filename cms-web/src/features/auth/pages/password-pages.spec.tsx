import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import { renderPage } from '../../../../test/utils/render-with-providers';
import { AcceptInvitationPage } from './AcceptInvitationPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';

const GOOD_PASSWORD = 'correct-horse-1';

async function setPassword(user: ReturnType<typeof renderPage>['user'], confirm = GOOD_PASSWORD) {
  await user.type(screen.getByLabelText('New password'), GOOD_PASSWORD);
  await user.type(screen.getByLabelText('Confirm password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Set password' }));
}

describe('ForgotPasswordPage', () => {
  it('confirms without saying whether the account exists', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/admin/auth/password/forgot', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderPage(<ForgotPasswordPage />);

    await expectNoA11yViolations();
    await user.type(screen.getByLabelText('Email'), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/If that address has an account/);
    expect(body).toEqual({ email: 'a@example.com' });
  });

  it('shows a failure, and checks the address first', async () => {
    server.use(
      http.post('*/api/admin/auth/password/forgot', () => new HttpResponse(null, { status: 429 })),
    );
    const { user } = renderPage(<ForgotPasswordPage />);

    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('This field is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Too many requests/);
  });
});

describe.each([
  {
    name: 'ResetPasswordPage',
    page: <ResetPasswordPage />,
    url: '*/api/admin/auth/password/reset',
    done: /password has been changed/,
    missing: /Request a new one/,
  },
  {
    name: 'AcceptInvitationPage',
    page: <AcceptInvitationPage />,
    url: '*/api/admin/auth/invitations/accept',
    done: /account is ready/,
    missing: /Ask your administrator/,
  },
])('$name', ({ page, url, done, missing }) => {
  const withToken = { route: '/x?token=abc' };

  it('sets the password with the token from the link', async () => {
    let body: unknown;
    server.use(
      http.post(url, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderPage(page, withToken);

    await expectNoA11yViolations();
    await setPassword(user);

    expect(await screen.findByRole('status')).toHaveTextContent(done);
    expect(body).toEqual({ token: 'abc', new_password: GOOD_PASSWORD });
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument();
  });

  it('shows what the server says about a bad token', async () => {
    server.use(
      http.post(url, () =>
        HttpResponse.json(
          { error: { code: 'INVALID_RESET_TOKEN', message: 'This link has expired' } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderPage(page, withToken);

    await setPassword(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('This link has expired');
  });

  it('holds a password to the policy and to its confirmation', async () => {
    const { user } = renderPage(page, withToken);

    await setPassword(user, 'different');

    expect(await screen.findByText('The passwords do not match')).toBeInTheDocument();
  });

  it('explains a link with no token', () => {
    renderPage(page);

    expect(screen.getByRole('alert')).toHaveTextContent(missing);
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});
