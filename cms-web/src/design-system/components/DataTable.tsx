import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import { visuallyHidden } from '@mui/utils';
import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface Column<T> {
  readonly key: string;
  readonly header: string;
  readonly sortable?: boolean;
  readonly hideHeader?: boolean;
  render(row: T): ReactNode;
}

export interface TableSort {
  readonly key: string;
  readonly direction: SortDirection;
}

export interface DataTableProps<T> {
  readonly caption: string;
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  rowKey(row: T): string;
  onRowClick?(row: T): void;
  readonly sort?: TableSort;
  onSort?(key: string): void;
  // The footer, such as the pager, so it scrolls with the table.
  readonly footer?: ReactNode;
}

interface HeaderProps<T> {
  readonly column: Column<T>;
  readonly sort: TableSort | undefined;
  onSort: ((key: string) => void) | undefined;
}

function HeaderCell<T>({ column, sort, onSort }: HeaderProps<T>) {
  const active = sort?.key === column.key;
  const direction = active ? sort.direction : 'asc';
  const label =
    column.hideHeader === true ? (
      <span style={visuallyHidden}>{column.header}</span>
    ) : (
      column.header
    );
  const ariaSort = !active ? 'none' : direction === 'asc' ? 'ascending' : 'descending';
  return (
    <TableCell scope="col" {...(column.sortable === true ? { 'aria-sort': ariaSort } : {})}>
      {column.sortable === true ? (
        <TableSortLabel
          active={active}
          direction={direction}
          onClick={() => {
            onSort?.(column.key);
          }}
        >
          {label}
        </TableSortLabel>
      ) : (
        label
      )}
    </TableCell>
  );
}

// 03-DESIGN 10.7 and 17.3
export function DataTable<T>(props: DataTableProps<T>) {
  const { caption, columns, rows, rowKey, onRowClick, sort, onSort, footer } = props;
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: '70vh' }}>
        <Table stickyHeader>
          <caption style={visuallyHidden}>{caption}</caption>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <HeaderCell key={column.key} column={column} sort={sort} onSort={onSort} />
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                hover
                sx={{ height: 52, cursor: onRowClick ? 'pointer' : 'default' }}
                {...(onRowClick
                  ? {
                      onClick: () => {
                        onRowClick(row);
                      },
                    }
                  : {})}
              >
                {columns.map((column) => (
                  <TableCell key={column.key}>{column.render(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {footer}
    </Paper>
  );
}
