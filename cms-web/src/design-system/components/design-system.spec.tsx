import { screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/utils/a11y';
import { renderWithTheme } from '../../../test/utils/render-with-providers';
import { AddIcon } from '../icons';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
import { Crumbs } from './Crumbs';
import { type Column, DataTable, type DataTableProps } from './DataTable';
import { EmptyState } from './EmptyState';
import { FormBanner } from './FormBanner';
import { PageHeader } from './PageHeader';
import { CardsSkeleton, TableSkeleton } from './Skeletons';
import { StatCard } from './StatCard';
import { StatusScreen } from './StatusScreen';
import { TablePager } from './TablePager';

describe('PageHeader', () => {
  it('names the page and holds its action', async () => {
    renderWithTheme(<PageHeader title="Articles" action={<button>New</button>} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Articles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    await expectNoA11yViolations();
  });
});

describe('Crumbs', () => {
  it('links everything except the current item', async () => {
    renderWithTheme(
      <MemoryRouter>
        <Crumbs label="Trail" items={[{ label: 'Articles', href: '/a' }, { label: 'Editing' }]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Articles' })).toHaveAttribute('href', '/a');
    expect(screen.queryByRole('link', { name: 'Editing' })).not.toBeInTheDocument();
    expect(screen.getByText('Editing')).toHaveAttribute('aria-current', 'page');
    await expectNoA11yViolations();
  });
});

describe('EmptyState', () => {
  it('shows everything it is given', async () => {
    renderWithTheme(
      <EmptyState
        icon={<AddIcon />}
        title="No articles yet"
        description="Create one"
        action={<button>New</button>}
        secondaryAction={<button>Other</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No articles yet' })).toBeInTheDocument();
    expect(screen.getByText('Create one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Other' })).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('leaves out a description it was not given', () => {
    const { container } = renderWithTheme(<EmptyState icon={<AddIcon />} title="T" />);

    expect(container.querySelector('p')).toBeNull();
  });
});

describe('StatusScreen', () => {
  it('shows the detail and the action', async () => {
    renderWithTheme(
      <StatusScreen
        icon={<AddIcon />}
        title="Oops"
        description="Failed"
        detail="Request ID: 1"
        action={<button>Retry</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Oops' })).toBeInTheDocument();
    expect(screen.getByText('Request ID: 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('leaves out a detail of null, and an action it was not given', () => {
    renderWithTheme(
      <StatusScreen icon={<AddIcon />} title="Oops" description="Failed" detail={null} />,
    );

    expect(screen.queryByText('Request ID', { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  const setup = (props: Partial<ConfirmDialogProps> = {}) => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const view = renderWithTheme(
      <ConfirmDialog
        open
        title="Delete this article?"
        body="It moves to the trash."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />,
    );
    return { ...view, onConfirm, onCancel };
  };

  it('confirms and cancels', async () => {
    const { user, onConfirm, onCancel } = setup();

    await expectNoA11yViolations();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('closes on Escape (03-DESIGN 17.2)', async () => {
    const { user, onCancel } = setup();

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('holds back an irreversible action until the name is typed', async () => {
    const { user, onConfirm } = setup({
      requireText: 'hero.jpg',
      requireTextLabel: 'Type the name',
    });
    const confirm = screen.getByRole('button', { name: 'Delete' });

    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Type the name'), 'hero.jp');
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Type the name'), 'g');
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('forgets what was typed when cancelled', async () => {
    const { user } = setup({ requireText: 'x', requireTextLabel: 'Name' });

    await user.type(screen.getByLabelText('Name'), 'x');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('cannot be confirmed twice while working', () => {
    setup({ pending: true, destructive: true });

    expect(within(screen.getByRole('dialog')).getAllByRole('button')[1]).toBeDisabled();
  });
});

describe('FormBanner', () => {
  it.each([
    ['error', 'alert'],
    ['info', 'status'],
    ['warning', 'status'],
  ] as const)('announces %s with role %s', async (tone, role) => {
    renderWithTheme(<FormBanner message="Careful" tone={tone} />);

    expect(screen.getByRole(role)).toHaveTextContent('Careful');
    await expectNoA11yViolations();
  });

  it('is an error unless told otherwise', () => {
    renderWithTheme(<FormBanner message="Failed" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

interface Row {
  readonly id: string;
  readonly name: string;
}

const columns: readonly Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true, render: (row) => row.name },
  { key: 'other', header: 'Other', sortable: true, render: () => 'x' },
  { key: 'plain', header: 'Plain', render: () => 'y' },
  { key: 'menu', header: 'Actions', hideHeader: true, render: () => <button>Open</button> },
];

describe('DataTable', () => {
  const setup = (props: Partial<DataTableProps<Row>> = {}) =>
    renderWithTheme(
      <DataTable
        caption="People"
        columns={columns}
        rows={[
          { id: '1', name: 'Ann' },
          { id: '2', name: 'Bob' },
        ]}
        rowKey={(row) => row.id}
        {...props}
      />,
    );

  it('uses real table semantics (03-DESIGN 17.3)', async () => {
    setup({ footer: <div>Footer</div> });

    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    expect(screen.getByRole('cell', { name: 'Bob' })).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('reports which column is sorted and which way', () => {
    setup({ sort: { key: 'name', direction: 'desc' } });

    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: /Other/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
    expect(screen.getByRole('columnheader', { name: 'Plain' })).not.toHaveAttribute('aria-sort');
  });

  it('reports ascending too', () => {
    setup({ sort: { key: 'name', direction: 'asc' } });

    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('asks to sort when a sortable header is pressed', async () => {
    const onSort = vi.fn();
    const { user } = setup({ onSort });

    await user.click(screen.getByRole('button', { name: 'Name' }));

    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('survives a sortable header with no handler', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Name' }));

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('opens a row when pressed, if it can', async () => {
    const onRowClick = vi.fn();
    const { user } = setup({ onRowClick });

    await user.click(screen.getByRole('cell', { name: 'Ann' }));

    expect(onRowClick).toHaveBeenCalledWith({ id: '1', name: 'Ann' });
  });
});

describe('TablePager', () => {
  const setup = (page: number, totalPages: number) => {
    const onPage = vi.fn();
    const view = renderWithTheme(
      <TablePager
        page={page}
        totalPages={totalPages}
        label={`Page ${String(page)}`}
        navLabel="Pages"
        previousLabel="Prev"
        nextLabel="Next"
        onPage={onPage}
      />,
    );
    return { ...view, onPage };
  };

  it('moves in both directions', async () => {
    const { user, onPage } = setup(2, 3);

    await user.click(screen.getByRole('button', { name: 'Prev' }));
    expect(onPage).toHaveBeenLastCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenLastCalledWith(3);
    await expectNoA11yViolations();
  });

  it('stops at either end', () => {
    setup(1, 1);

    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

describe('Skeletons', () => {
  it('announce that the page is busy', () => {
    renderWithTheme(
      <>
        <TableSkeleton label="Loading rows" />
        <CardsSkeleton label="Loading cards" count={2} />
      </>,
    );

    expect(screen.getByRole('status', { name: 'Loading rows' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByRole('status', { name: 'Loading cards' }).children).toHaveLength(2);
  });
});

describe('StatCard', () => {
  it('shows the number and what it counts', () => {
    renderWithTheme(<StatCard label="Drafts" value={27} icon={<AddIcon />} />);

    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();
  });
});
