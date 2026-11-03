import Button from '@mui/material/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '../../../design-system/components/ConfirmDialog';
import { EmptyState } from '../../../design-system/components/EmptyState';
import { PageHeader } from '../../../design-system/components/PageHeader';
import { AddIcon, KeyIcon } from '../../../design-system/icons';
import type { ApiKeyRow } from '../../../shared/api/types';
import { copyToClipboard } from '../../../shared/browser/clipboard';
import { QueryBoundary } from '../../../shared/components/QueryBoundary';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { notify } from '../../../shared/stores/ui.store';
import { errorToMessage } from '../../../shared/streams/global-errors.stream';
import { apiKeyMessages as m } from '../api-keys.messages';
import { createApiKey, listApiKeys, revokeApiKey } from '../api/api-keys.api';
import { CreateKeyDialog, ShowKeyDialog } from '../components/ApiKeyDialogs';
import { ApiKeysTable } from '../components/ApiKeysTable';

const KEYS = ['api-keys'];

async function copyKey(key: string): Promise<void> {
  if (await copyToClipboard(key)) notify.success(common.copied);
  else notify.error(common.copyFailed);
}

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEYS });
  const query = useQuery({ queryKey: KEYS, queryFn: listApiKeys });
  const create = useMutation({
    mutationFn: createApiKey,
    meta: { handlesErrors: true },
    onSuccess: ({ key }) => {
      setCreating(false);
      setCreated(key);
      return refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (key: ApiKeyRow) => revokeApiKey(key.id),
    onSuccess: () => {
      notify.success(m.revokedDone);
      return refresh();
    },
  });
  const startCreating = () => {
    create.reset();
    setCreating(true);
  };

  return (
    <>
      <PageHeader
        title={m.title}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={startCreating}>
            {m.newKey}
          </Button>
        }
      />
      <QueryBoundary query={query}>
        {(keys) =>
          keys.length === 0 ? (
            <EmptyState icon={<KeyIcon />} title={m.empty} description={m.emptyHint} />
          ) : (
            <ApiKeysTable rows={keys} onRevoke={setRevoking} />
          )
        }
      </QueryBoundary>
      {creating ? (
        <CreateKeyDialog
          pending={create.isPending}
          error={create.isError ? errorToMessage(create.error) : null}
          onSubmit={(name) => {
            create.mutate(name);
          }}
          onClose={() => {
            setCreating(false);
          }}
        />
      ) : null}
      {created === null ? null : (
        <ShowKeyDialog
          apiKey={created}
          onCopy={() => {
            void copyKey(created);
          }}
          onClose={() => {
            setCreated(null);
          }}
        />
      )}
      {revoking === null ? null : (
        <ConfirmDialog
          open
          destructive
          title={m.revokeTitle}
          body={format(m.revokeBody, { name: revoking.name })}
          confirmLabel={m.revoke}
          cancelLabel={common.cancel}
          requireText={revoking.name}
          requireTextLabel={m.revokeConfirmLabel}
          onCancel={() => {
            setRevoking(null);
          }}
          onConfirm={() => {
            revoke.mutate(revoking);
            setRevoking(null);
          }}
        />
      )}
    </>
  );
}
