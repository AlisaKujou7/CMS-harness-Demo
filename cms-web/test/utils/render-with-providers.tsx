import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router';
import { createCmsTheme } from '../../src/design-system/theme/create-theme';
import { createQueryClient } from '../../src/shared/api/query-client';
import { ToastHost } from '../../src/shared/components/ToastHost';
import type { SessionUser } from '../../src/shared/stores/session.store';
import { useSessionStore } from '../../src/shared/stores/session.store';

export const anAdmin: SessionUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@example.com',
  name: 'Ada Admin',
  role: 'admin',
};
export const anEditor: SessionUser = {
  ...anAdmin,
  id: anAdmin.id.replace('1', '2'),
  role: 'editor',
};
export const anAuthor: SessionUser = {
  ...anAdmin,
  id: anAdmin.id.replace('1', '3'),
  role: 'author',
};

export function signIn(user: SessionUser = anAdmin): void {
  useSessionStore.setState({ status: 'authenticated', accessToken: 'test-token', user });
}

export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <ThemeProvider theme={createCmsTheme('light')}>
      <QueryClientProvider client={createQueryClient()}>
        {children}
        <ToastHost />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export interface RenderPageOptions {
  readonly route?: string;
  readonly path?: string;
  readonly routes?: readonly RouteObject[];
}

// Renders a page inside a real router, so links, params and blockers behave as they do in the app.
export function renderPage(page: ReactElement, options: RenderPageOptions = {}) {
  const { route = '/', path = '*', routes = [] } = options;
  const router = createMemoryRouter(
    [{ path, element: page }, ...routes, { path: '*', element: <div>Elsewhere</div> }],
    { initialEntries: [route] },
  );
  const view = render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...view, router, user: userEvent.setup() };
}

export function renderWithTheme(element: ReactElement) {
  const view = render(<ThemeProvider theme={createCmsTheme('light')}>{element}</ThemeProvider>);
  return { ...view, user: userEvent.setup() };
}
