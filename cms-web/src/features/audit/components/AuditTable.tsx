import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';
import { type Column, DataTable } from '../../../design-system/components/DataTable';
import type { AuditRow, Pagination, UserRow } from '../../../shared/api/types';
import { actorName } from '../../../shared/audit/audit-labels';
import { Pager } from '../../../shared/components/Pager';
import { formatDateTime } from '../../../shared/utils/time';
import { isLongSummary, previewOf, summaryText } from '../audit-filters';
import { auditPageMessages as m } from '../audit.messages';

function Summary({ value }: { readonly value: unknown }) {
  const [open, setOpen] = useState(false);
  const text = summaryText(value);
  if (text === '') return m.noSummary;
  return (
    <>
      <code style={{ wordBreak: 'break-all' }}>{open ? text : previewOf(text)}</code>
      {isLongSummary(text) ? (
        <Button
          size="small"
          aria-expanded={open}
          onClick={() => {
            setOpen((value_) => !value_);
          }}
        >
          {open ? m.showLess : m.showMore}
        </Button>
      ) : null}
    </>
  );
}

export interface AuditTableProps {
  readonly rows: readonly AuditRow[];
  readonly users: readonly UserRow[];
  readonly pagination: Pagination;
  onPage(page: number): void;
}

function Actor({ id, users }: { readonly id: string | null; readonly users: readonly UserRow[] }) {
  const email = users.find((user) => user.id === id)?.email ?? '';
  return (
    <Tooltip title={email}>
      <span>{actorName(id, users)}</span>
    </Tooltip>
  );
}

export function AuditTable({ rows, users, pagination, onPage }: AuditTableProps) {
  const columns: readonly Column<AuditRow>[] = [
    { key: 'at', header: m.timestamp, render: (row) => formatDateTime(row.occurred_at) },
    { key: 'actor', header: m.actor, render: (row) => <Actor id={row.actor_id} users={users} /> },
    {
      key: 'action',
      header: m.action,
      render: (row) => <Chip size="small" label={row.action} />,
    },
    {
      key: 'target',
      header: m.target,
      render: (row) => [row.target_type, row.target_id].filter(Boolean).join(' '),
    },
    { key: 'summary', header: m.summary, render: (row) => <Summary value={row.summary} /> },
  ];
  return (
    <DataTable
      caption={m.caption}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      footer={<Pager pagination={pagination} onPage={onPage} />}
    />
  );
}
