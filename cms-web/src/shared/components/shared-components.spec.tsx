import { screen } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/utils/a11y';
import { renderPage, renderWithTheme } from '../../../test/utils/render-with-providers';
import { aPage } from '../../../test/builders';
import { ApiError } from '../api/api-error';
import { Pager } from './Pager';
import { QueryBoundary } from './QueryBoundary';
import { RowMenu } from './RowMenu';

const queryState = (state: Partial<UseQueryResult<string>>) => state as UseQueryResult<string>;

describe('QueryBoundary', () => {
  const show = (data: string) => <div>{data}</div>;

  it('shows a skeleton while loading, or the one it was given', () => {
    const pending = queryState({ isPending: true });
    const { unmount } = renderPage(<QueryBoundary query={pending}>{show}</QueryBoundary>);
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true');
    unmount();

    renderPage(
      <QueryBoundary query={pending} skeleton={<div>Custom</div>}>
        {show}
      </QueryBoundary>,
    );
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('offers a retry when loading failed', async () => {
    const refetch = vi.fn().mockResolvedValue({});
    const failed = queryState({
      isPending: false,
      isError: true,
      error: new ApiError({ status: 500, code: 'X', message: 'm' }),
      refetch,
    });
    const { user } = renderPage(<QueryBoundary query={failed}>{show}</QueryBoundary>);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('renders the data', () => {
    const loaded = queryState({ isPending: false, isError: false, data: 'Hello' });

    renderPage(<QueryBoundary query={loaded}>{show}</QueryBoundary>);

    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});

describe('Pager', () => {
  it('shows where you are and moves', async () => {
    const onPage = vi.fn();
    const { user } = renderWithTheme(
      <Pager pagination={aPage({ page: 2, total_pages: 6 })} onPage={onPage} />,
    );

    expect(screen.getByText('Page 2 of 6')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(onPage).toHaveBeenCalledWith(3);
  });

  it('counts an empty list as one page', () => {
    renderWithTheme(<Pager pagination={aPage({ total: 0, total_pages: 0 })} onPage={vi.fn()} />);

    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });
});

describe('RowMenu', () => {
  it('runs the chosen action without opening the row', async () => {
    const run = vi.fn();
    const onRow = vi.fn();
    const { user } = renderWithTheme(
      <div onClick={onRow}>
        <RowMenu
          label="More for X"
          actions={[
            { label: 'Edit', icon: null, run },
            { label: 'Delete', icon: null, danger: true, run: vi.fn() },
          ]}
        />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'More for X' }));
    await expectNoA11yViolations();
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(run).toHaveBeenCalledOnce();
    expect(onRow).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const { user } = renderWithTheme(
      <RowMenu label="More" actions={[{ label: 'Edit', icon: null, run: vi.fn() }]} />,
    );

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
  });
});
