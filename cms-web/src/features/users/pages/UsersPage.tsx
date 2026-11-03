import Button from '@mui/material/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '../../../design-system/components/ConfirmDialog';
import { PageHeader } from '../../../design-system/components/PageHeader';
import { AddIcon } from '../../../design-system/icons';
import type { InviteBody, UserRow } from '../../../shared/api/types';
import { QueryBoundary } from '../../../shared/components/QueryBoundary';
import { useQueryParams } from '../../../shared/hooks/useQueryParams';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { notify } from '../../../shared/stores/ui.store';
import { errorToMessage } from '../../../shared/streams/global-errors.stream';
import { inviteUser, listUsers, updateUser } from '../api/users.api';
import {
  EditUserDialog,
  InviteDialog,
  type EditValues,
  type InviteValues,
} from '../components/UserDialogs';
import { UsersTable } from '../components/UsersTable';
import { useUserActions } from '../hooks/useUserActions';
import { userMessages as m } from '../users.messages';

type Pending =
  | { readonly kind: 'invite' }
  | { readonly kind: 'edit' | 'deactivate' | 'delete'; readonly user: UserRow }
  | null;

function toInviteBody({ email, name, role }: InviteValues): InviteBody {
  return { email, role, ...(name === '' ? {} : { name }) };
}

function useUserForms(close: () => void) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] });
  const invite = useMutation({
    mutationFn: (values: InviteValues) => inviteUser(toInviteBody(values)),
    meta: { handlesErrors: true },
    onSuccess: (user) => {
      notify.success(format(m.invited, { email: user.email }));
      close();
      return refresh();
    },
  });
  const edit = useMutation({
    mutationFn: ({ id, values }: { id: string; values: EditValues }) => updateUser(id, values),
    meta: { handlesErrors: true },
    onSuccess: () => {
      notify.success(m.updated);
      close();
      return refresh();
    },
  });
  return { invite, edit };
}

const failure = (mutation: { isError: boolean; error: unknown }) =>
  mutation.isError ? errorToMessage(mutation.error) : null;

// 03-DESIGN 12.6
export function UsersPage() {
  const { page, setPage } = useQueryParams();
  const [pending, setPending] = useState<Pending>(null);
  const close = () => {
    setPending(null);
  };
  const query = useQuery({ queryKey: ['users', 'list', page], queryFn: () => listUsers(page) });
  const { invite, edit } = useUserForms(close);
  const actions = useUserActions();

  return (
    <>
      <PageHeader
        title={m.title}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              invite.reset();
              setPending({ kind: 'invite' });
            }}
          >
            {m.invite}
          </Button>
        }
      />
      <QueryBoundary query={query}>
        {({ data, pagination }) => (
          <UsersTable
            rows={data}
            pagination={pagination}
            onPage={setPage}
            onEdit={(user) => {
              edit.reset();
              setPending({ kind: 'edit', user });
            }}
            onDeactivate={(user) => {
              setPending({ kind: 'deactivate', user });
            }}
            onDelete={(user) => {
              setPending({ kind: 'delete', user });
            }}
            onResetPassword={(user) => {
              actions.resetPassword.mutate(user);
            }}
            onResendInvite={(user) => {
              actions.resendInvite.mutate(user);
            }}
          />
        )}
      </QueryBoundary>
      {pending?.kind === 'invite' ? (
        <InviteDialog
          pending={invite.isPending}
          error={failure(invite)}
          onClose={close}
          onSubmit={(values) => {
            invite.mutate(values);
          }}
        />
      ) : null}
      {pending?.kind === 'edit' ? (
        <EditUserDialog
          user={pending.user}
          pending={edit.isPending}
          error={failure(edit)}
          onClose={close}
          onSubmit={(values) => {
            edit.mutate({ id: pending.user.id, values });
          }}
        />
      ) : null}
      {pending?.kind === 'deactivate' ? (
        <ConfirmDialog
          open
          destructive
          title={format(m.deactivateTitle, { name: pending.user.name })}
          body={m.deactivateBody}
          confirmLabel={m.deactivate}
          cancelLabel={common.cancel}
          onCancel={close}
          onConfirm={() => {
            actions.deactivate.mutate(pending.user);
            close();
          }}
        />
      ) : null}
      {pending?.kind === 'delete' ? (
        <ConfirmDialog
          open
          destructive
          title={format(m.deleteTitle, { name: pending.user.name })}
          body={m.deleteBody}
          confirmLabel={common.delete}
          cancelLabel={common.cancel}
          requireText={pending.user.email}
          requireTextLabel={m.email}
          onCancel={close}
          onConfirm={() => {
            actions.remove.mutate(pending.user);
            close();
          }}
        />
      ) : null}
    </>
  );
}
