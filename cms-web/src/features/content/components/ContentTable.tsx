import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router';
import {
  type Column,
  DataTable,
  type TableSort,
} from '../../../design-system/components/DataTable';
import type { ContentListRow, Pagination } from '../../../shared/api/types';
import { Pager } from '../../../shared/components/Pager';
import { type RowAction, RowMenu } from '../../../shared/components/RowMenu';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { formatRelative } from '../../../shared/utils/time';
import { contentMessages as m } from '../content.messages';
import { displayStatus, editorPath } from '../types/content.types';
import { StatusChip } from './StatusChip';

export interface ContentTableProps {
  readonly rows: readonly ContentListRow[];
  readonly pagination: Pagination;
  readonly sort: TableSort;
  actionsFor(row: ContentListRow): readonly RowAction[];
  onOpen(row: ContentListRow): void;
  onSort(key: string): void;
  onPage(page: number): void;
}

// 03-DESIGN 12.3. The title is a real link, so a keyboard reaches what a click on the row opens.
export function ContentTable(props: ContentTableProps) {
  const { rows, pagination, sort, actionsFor, onOpen, onSort, onPage } = props;
  const columns: readonly Column<ContentListRow>[] = [
    {
      key: 'title',
      header: m.list.title,
      sortable: true,
      render: (row) => (
        <Link
          component={RouterLink}
          to={editorPath(row.type, row.id)}
          color="inherit"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: 'status',
      header: m.list.status,
      render: (row) => <StatusChip status={displayStatus(row.status, row.scheduled_at)} />,
    },
    { key: 'author', header: m.list.author, render: (row) => row.author_name },
    {
      key: 'updated',
      header: m.list.updated,
      sortable: true,
      render: (row) => formatRelative(row.updated_at),
    },
    {
      key: 'menu',
      header: common.actions,
      hideHeader: true,
      render: (row) => (
        <RowMenu
          label={format(common.moreActions, { name: row.title })}
          actions={actionsFor(row)}
        />
      ),
    },
  ];
  return (
    <DataTable
      caption={m.list.caption}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      sort={sort}
      onSort={onSort}
      onRowClick={onOpen}
      footer={<Pager pagination={pagination} onPage={onPage} />}
    />
  );
}
