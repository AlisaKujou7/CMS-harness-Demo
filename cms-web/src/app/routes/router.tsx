import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import type { ContentType } from '../../shared/api/types';
import { NotFoundScreen } from '../../shared/components/PageErrors';
import { AppShell } from '../layouts/AppShell';
import { RouteError } from './RouteError';
import { RequireAnonymous, RequireRole, RequireSession } from './guards';

function contentRoutes(segment: string, type: ContentType): RouteObject[] {
  return [
    {
      path: `content/${segment}`,
      lazy: async () => {
        const { ContentListPage } = await import('../../features/content/pages/ContentListPage');
        return { element: <ContentListPage key={type} type={type} /> };
      },
    },
    {
      path: `content/${segment}/:id`,
      lazy: async () => {
        const { ContentEditorPage } =
          await import('../../features/content/pages/ContentEditorPage');
        return { element: <ContentEditorPage type={type} /> };
      },
    },
    {
      path: `content/${segment}/:id/versions`,
      lazy: async () => {
        const { VersionHistoryPage } =
          await import('../../features/content/pages/VersionHistoryPage');
        return { element: <VersionHistoryPage type={type} /> };
      },
    },
  ];
}

const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <RequireAnonymous />,
        children: [
          {
            path: 'login',
            lazy: async () => ({
              Component: (await import('../../features/auth/pages/LoginPage')).LoginPage,
            }),
          },
          {
            path: 'forgot-password',
            lazy: async () => ({
              Component: (await import('../../features/auth/pages/ForgotPasswordPage'))
                .ForgotPasswordPage,
            }),
          },
        ],
      },
      {
        path: 'reset-password',
        lazy: async () => ({
          Component: (await import('../../features/auth/pages/ResetPasswordPage'))
            .ResetPasswordPage,
        }),
      },
      {
        path: 'accept-invitation',
        lazy: async () => ({
          Component: (await import('../../features/auth/pages/AcceptInvitationPage'))
            .AcceptInvitationPage,
        }),
      },
      {
        element: <RequireSession />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('../../features/dashboard/pages/DashboardPage'))
                    .DashboardPage,
                }),
              },
              { path: 'content', element: <Navigate to="/content/articles" replace /> },
              ...contentRoutes('articles', 'article'),
              ...contentRoutes('pages', 'page'),
              {
                path: 'media',
                lazy: async () => ({
                  Component: (await import('../../features/media/pages/MediaLibraryPage'))
                    .MediaLibraryPage,
                }),
              },
              {
                path: 'settings/profile',
                lazy: async () => ({
                  Component: (await import('../../features/profile/pages/ProfilePage')).ProfilePage,
                }),
              },
              {
                element: <RequireRole allowed="admin" />,
                children: [
                  {
                    path: 'users',
                    lazy: async () => ({
                      Component: (await import('../../features/users/pages/UsersPage')).UsersPage,
                    }),
                  },
                  {
                    path: 'audit',
                    lazy: async () => ({
                      Component: (await import('../../features/audit/pages/AuditPage')).AuditPage,
                    }),
                  },
                  {
                    path: 'api-keys',
                    lazy: async () => ({
                      Component: (await import('../../features/api-keys/pages/ApiKeysPage'))
                        .ApiKeysPage,
                    }),
                  },
                ],
              },
              { path: '*', element: <NotFoundScreen /> },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
