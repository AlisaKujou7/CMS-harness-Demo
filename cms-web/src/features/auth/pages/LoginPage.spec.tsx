import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import { anAdmin, renderPage } from '../../../../test/utils/render-with-providers';
import { useSessionStore } from '../../../shared/stores/session.store';
import { LoginPage, safeReturnPath } from './LoginPage';

const LOGIN = '*/api/admin/auth/login';
const session = { access_token: 't', expires_in: 900, user: anAdmin };

async function signIn(user: ReturnType<typeof renderPage>['user']) {
  await user.type(screen.getByLabelText('Email'), 'a@example.com');
  await user.type(screen.getByLabelText('Password'), 'secret-password-1');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginPage', () => {
  it('signs in and goes to the dashboard', async () => {
    let body: unknown;
    server.use(
      http.post(LOGIN, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: session });
      }),
    );
    const { user, router } = renderPage(<LoginPage />, { route: '/login', path: '/login' });

    await expectNoA11yViolations();
    await signIn(user);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(body).toEqual({ email: 'a@example.com', password: 'secret-password-1' });
    expect(useSessionStore.getState()).toMatchObject({ status: 'authenticated', accessToken: 't' });
  });

  it('shows a generic message for wrong credentials (FR-AUTH-06)', async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json(
          { error: { code: 'INVALID_CREDENTIALS', message: 'server words' } },
          { status: 401 },
        ),
      ),
    );
    const { user } = renderPage(<LoginPage />);

    await signIn(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect/);
    expect(screen.queryByText('server words')).not.toBeInTheDocument();
  });

  it('explains a rate limit', async () => {
    server.use(
      http.post(
        LOGIN,
        () =>
          new HttpResponse(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'x' } }), {
            status: 429,
            headers: { 'Retry-After': '30', 'Content-Type': 'application/json' },
          }),
      ),
    );
    const { user } = renderPage(<LoginPage />);

    await signIn(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('30 seconds');
  });

  it('checks the fields before asking the server', async () => {
    const { user } = renderPage(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findAllByText('This field is required')).toHaveLength(2);
  });

  it('links to the password reset', () => {
    renderPage(<LoginPage />);

    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});

describe('safeReturnPath', () => {
  it.each([
    ['/content/articles', '/content/articles'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    [undefined, '/'],
    [5, '/'],
  ])('reads %s as %s', (from, path) => {
    expect(safeReturnPath(from)).toBe(path);
  });
});
