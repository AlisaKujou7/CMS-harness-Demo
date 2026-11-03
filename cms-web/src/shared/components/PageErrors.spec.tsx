import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/utils/a11y';
import { renderPage } from '../../../test/utils/render-with-providers';
import { ApiError } from '../api/api-error';
import { ForbiddenScreen, NotFoundScreen, QueryError } from './PageErrors';

const anError = (status: number, requestId: string | null = null) =>
  new ApiError({ status, code: 'X', message: 'm', requestId });

describe('page errors', () => {
  it('links back from a page that does not exist', async () => {
    renderPage(<NotFoundScreen />);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/');
    await expectNoA11yViolations();
  });

  it('links back from a page that is not allowed', () => {
    renderPage(<ForbiddenScreen />);

    expect(screen.getByRole('heading', { name: /permission/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toBeInTheDocument();
  });

  it('shows the matching screen for a 404 and a 403', () => {
    const { unmount } = renderPage(<QueryError error={anError(404)} onRetry={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    unmount();

    renderPage(<QueryError error={anError(403)} onRetry={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /permission/ })).toBeInTheDocument();
  });

  it('offers a retry and the request id for anything else', async () => {
    const onRetry = vi.fn();
    const { user } = renderPage(<QueryError error={anError(500, 'r-1')} onRetry={onRetry} />);

    expect(screen.getByText('Request ID: r-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('copes with an error that has no request id', () => {
    renderPage(<QueryError error={new Error('other')} onRetry={vi.fn()} />);

    expect(screen.queryByText(/Request ID/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
