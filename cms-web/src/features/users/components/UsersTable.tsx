import Chip from '@mui/material/Chip';
import { type Column, DataTable } from '../../../design-system/components/DataTable';
import {
  DeleteIcon,
  EditIcon,
  KeyIcon,
  SendIcon,
  UnpublishIcon,
} from '../../../design-system/icons';
import type { Pagination, UserRow } from '../../../shared/api/types';
import { Pager } from '../../../shared/components/Pager';
import { type RowAction, RowMenu } from '../../../shared/components/RowMenu';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { formatRelative } from '../../../shared/utils/time';
import { userMessages as m } from '../users.messages';

export interface UserRowHandlers {
  onEdit(user: UserRow): void;
  onDeactivate(user: UserRow): void;
  onResetPassword(user: UserRow): void;
  onResendInvite(user: UserRow): void;
  onDelete(user: UserRow): void;
}

export interface UsersTableProps extends UserRowHandlers {
  readonly rows: readonly UserRow[];
  readonly pagination: Pagination;
  onPage(page: number): void;
}

// The API answers 409 for what does not apply, so the menu only offers what can work.
export function userActions(user: UserRow, handlers: UserRowHandlers): RowAction[] {
  const on = (run: (target: UserRow) => void) => () => {
    run(user);
  };
  const { status } = user;
  return [
    { label: m.editUser, icon: <EditIcon />, run: on(handlers.onEdit) },
    ...(status === 'active'
      ? [{ label: m.resetPassword, icon: <KeyIcon />, run: on(handlers.onResetPassword) }]
      : []),
    ...(status === 'invited'
      ? [{ label: m.resendInvite, icon: <SendIcon />, run: on(handlers.onResendInvite) }]
      : []),
    ...(status === 'deactivated'
      ? []
      : [{ label: m.deactivate, icon: <UnpublishIcon />, run: on(handlers.onDeactivate) }]),
    { label: m.deleteUser, icon: <DeleteIcon />, danger: true, run: on(handlers.onDelete) },
  ];
}

export function UsersTable({ rows, pagination, onPage, ...handlers }: UsersTableProps) {
  const columns: readonly Column<UserRow>[] = [
    { key: 'name', header: m.name, render: (user) => user.name },
    { key: 'email', header: m.email, render: (user) => user.email },
    { key: 'role', header: m.role, render: (user) => m.roles[user.role] },
    {
      key: 'status',
      header: m.status,
      render: (user) => <Chip size="small" label={m.statuses[user.status]} />,
    },
    {
      key: 'login',
      header: m.lastLogin,
      render: (user) =>
        user.last_login_at === null ? common.never : formatRelative(user.last_login_at),
    },
    {
      key: 'menu',
      header: common.actions,
      hideHeader: true,
      render: (user) => (
        <RowMenu
          label={format(common.moreActions, { name: user.name })}
          actions={userActions(user, handlers)}
        />
      ),
    },
  ];
  return (
    <DataTable
      caption={m.caption}
      columns={columns}
      rows={rows}
      rowKey={(user) => user.id}
      footer={<Pager pagination={pagination} onPage={onPage} />}
    />
  );
}
