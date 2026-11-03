import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { type Column, DataTable } from '../../../design-system/components/DataTable';
import type { ApiKeyRow } from '../../../shared/api/types';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { formatRelative } from '../../../shared/utils/time';
import { apiKeyMessages as m } from '../api-keys.messages';

export interface ApiKeysTableProps {
  readonly rows: readonly ApiKeyRow[];
  onRevoke(key: ApiKeyRow): void;
}

export function ApiKeysTable({ rows, onRevoke }: ApiKeysTableProps) {
  const columns: readonly Column<ApiKeyRow>[] = [
    { key: 'name', header: m.name, render: (key) => key.name },
    { key: 'prefix', header: m.prefix, render: (key) => <code>{key.prefix}</code> },
    {
      key: 'used',
      header: m.lastUsed,
      render: (key) =>
        key.last_used_at === null ? common.never : formatRelative(key.last_used_at),
    },
    {
      key: 'status',
      header: m.status,
      render: (key) => <Chip size="small" label={key.revoked_at === null ? m.active : m.revoked} />,
    },
    {
      key: 'revoke',
      header: common.actions,
      hideHeader: true,
      render: (key) =>
        key.revoked_at === null ? (
          <Button
            color="error"
            aria-label={format(m.revokeLabel, { name: key.name })}
            onClick={() => {
              onRevoke(key);
            }}
          >
            {m.revoke}
          </Button>
        ) : null,
    },
  ];
  return <DataTable caption={m.caption} columns={columns} rows={rows} rowKey={(key) => key.id} />;
}
