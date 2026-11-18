import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '../../../design-system/components/ConfirmDialog';
import { DeleteIcon } from '../../../design-system/icons';
import type { MediaDetail } from '../../../shared/api/types';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { deleteMedia } from '../../../shared/media/media.api';
import { notify } from '../../../shared/stores/ui.store';
import { libraryMessages as m } from '../media-library.messages';

export interface MediaDeleteProps {
  readonly item: MediaDetail;
  readonly isAdmin: boolean;
  onDeleted(): void;
}

// FR-MEDIA-07: what content uses stays, unless an Admin forces it. 03-DESIGN 13.5 asks for the name.
export function MediaDeleteContainer({ item, isAdmin, onDeleted }: MediaDeleteProps) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const inUse = item.usage_count > 0;
  const remove = useMutation({
    mutationFn: () => deleteMedia(item.id, inUse),
    onSuccess: () => {
      notify.success(m.deleted);
      onDeleted();
      queryClient.removeQueries({ queryKey: ['media', 'detail', item.id] });
      return queryClient.invalidateQueries({ queryKey: ['media', 'list'] });
    },
  });
  if (inUse && !isAdmin) {
    return (
      <Typography variant="bodySmall" color="text.secondary" component="p">
        {m.inUse}
      </Typography>
    );
  }
  return (
    <>
      <Button
        color="error"
        startIcon={<DeleteIcon />}
        sx={{ alignSelf: 'flex-start' }}
        onClick={() => {
          setConfirming(true);
        }}
      >
        {inUse ? m.forceDelete : m.delete}
      </Button>
      <ConfirmDialog
        open={confirming}
        destructive
        title={inUse ? m.forceTitle : m.deleteTitle}
        body={inUse ? format(m.forceBody, { count: item.usage_count }) : m.deleteBody}
        confirmLabel={inUse ? m.forceDelete : m.delete}
        cancelLabel={common.cancel}
        requireText={item.filename}
        requireTextLabel={m.confirmName}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          remove.mutate();
        }}
      />
    </>
  );
}
