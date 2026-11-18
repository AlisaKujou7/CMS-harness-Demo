import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { aListRow, anAuditEvent, aPage, aUser, ID } from '../../../../test/builders';
import { server } from '../../../../test/mocks/server';
import { expectNoA11yViolations } from '../../../../test/utils/a11y';
import { anAuthor, renderPage, signIn } from '../../../../test/utils/render-with-providers';
import { DashboardPage } from './DashboardPage';

const STATS = '*/api/admin/content/stats';
const stats = { draft: 27, in_review: 12, published: 98, unpublished: 1, archived: 2 };

function answerStats() {
  server.use(http.get(STATS, () => HttpResponse.json({ data: stats })));
}

describe('DashboardPage', () => {
  it('shows an Admin the counts and the audit trail', async () => {
    answerStats();
    server.use(
      http.get('*/api/admin/users', () =>
        HttpResponse.json({ data: [aUser({ id: ID.user, name: 'Alice' })], pagination: aPage() }),
      ),
      http.get('*/api/admin/audit', () =>
        HttpResponse.json({ data: [anAuditEvent()], pagination: aPage() }),
      ),
    );
    signIn();
    renderPage(<DashboardPage />);

    expect(await screen.findByText('140')).toBeInTheDocument();
    expect(screen.getByText('98')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();
    expect(await screen.findByText('Alice published content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View audit log' })).toHaveAttribute('href', '/audit');
    await expectNoA11yViolations();
  });

  it('shows anyone else their recent content, without touching the audit log', async () => {
    answerStats();
    server.use(
      http.get('*/api/admin/content', () =>
        HttpResponse.json({ data: [aListRow()], pagination: aPage() }),
      ),
    );
    signIn(anAuthor);
    renderPage(<DashboardPage />);

    expect(await screen.findByText('Alice updated "Q2 Report"')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recently updated' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View audit log' })).not.toBeInTheDocument();
  });

  it('greets by name, and offers the quick actions', async () => {
    answerStats();
    server.use(
      http.get('*/api/admin/content', () =>
        HttpResponse.json({ data: [], pagination: aPage({ total: 0 }) }),
      ),
    );
    signIn(anAuthor);
    renderPage(<DashboardPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(anAuthor.name);
    const card = screen.getByRole('heading', { name: 'Quick actions' }).closest('div');
    expect(within(card as HTMLElement).getByRole('link', { name: 'New Article' })).toHaveAttribute(
      'href',
      '/content/articles/new',
    );
    expect(await screen.findByText('Nothing has happened yet.')).toBeInTheDocument();
  });

  it('offers a retry when the counts fail', async () => {
    server.use(
      http.get(STATS, () => new HttpResponse(null, { status: 500 })),
      http.get('*/api/admin/content', () =>
        HttpResponse.json({ data: [], pagination: aPage({ total: 0 }) }),
      ),
    );
    signIn(anAuthor);
    renderPage(<DashboardPage />);

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
