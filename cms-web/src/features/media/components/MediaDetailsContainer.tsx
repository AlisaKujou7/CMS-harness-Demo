import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { CloseIcon, CopyIcon, DownloadIcon } from '../../../design-system/icons';
import type { MediaDetail } from '../../../shared/api/types';
import { copyToClipboard } from '../../../shared/browser/clipboard';
import { QueryBoundary } from '../../../shared/components/QueryBoundary';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { getMedia, updateMedia } from '../../../shared/media/media.api';
import { isImageMedia } from '../../../shared/media/media-validation';
import { useCurrentUser } from '../../../shared/stores/session.store';
import { notify } from '../../../shared/stores/ui.store';
import { formatBytes } from '../../../shared/utils/bytes';
import { formatRelative } from '../../../shared/utils/time';
import { canManage } from '../media-filters';
import { libraryMessages as m } from '../media-library.messages';
import { MediaDeleteContainer } from './MediaDeleteContainer';

export interface MediaDetailsProps {
  readonly id: string;
  onClose(): void;
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Typography variant="bodyMedium" component="p">
      <strong>{label}:</strong> {value}
    </Typography>
  );
}

function DetailsForm({
  item,
  editable,
}: {
  readonly item: MediaDetail;
  readonly editable: boolean;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit } = useForm({
    defaultValues: { alt_text: item.alt_text ?? '', caption: item.caption ?? '' },
  });
  const save = useMutation({
    mutationFn: (values: { alt_text: string; caption: string }) =>
      updateMedia(item.id, {
        alt_text: values.alt_text === '' ? null : values.alt_text,
        caption: values.caption === '' ? null : values.caption,
      }),
    onSuccess: () => {
      notify.success(m.saved);
      return queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });
  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={(event) => {
        void handleSubmit((values) => {
          save.mutate(values);
        })(event);
      }}
    >
      <TextField {...register('alt_text')} size="small" label={m.altText} disabled={!editable} />
      <TextField
        {...register('caption')}
        size="small"
        label={m.captionField}
        disabled={!editable}
      />
      {editable ? (
        <Button
          type="submit"
          variant="outlined"
          loading={save.isPending}
          sx={{ alignSelf: 'flex-start' }}
        >
          {m.save}
        </Button>
      ) : null}
    </Stack>
  );
}

async function copyUrl(url: string): Promise<void> {
  if (await copyToClipboard(url)) notify.success(common.copied);
  else notify.error(common.copyFailed);
}

function Details({ item, onClose }: { readonly item: MediaDetail; onClose(): void }) {
  const viewer = useCurrentUser();
  const editable = canManage(viewer, item);
  const { width, height } = item;
  return (
    <Stack spacing={2}>
      {isImageMedia(item.mime_type) ? (
        <img
          src={item.variants['medium']?.url ?? item.url}
          alt={item.alt_text ?? ''}
          style={{ maxWidth: '100%', borderRadius: 4 }}
        />
      ) : null}
      <DetailsForm key={item.id} item={item} editable={editable} />
      <Divider />
      <Fact label={m.filename} value={item.filename} />
      <Fact label={m.size} value={formatBytes(item.size_bytes)} />
      {width !== null && height !== null ? (
        <Fact label={m.dimensions} value={`${String(width)} × ${String(height)}`} />
      ) : null}
      <Fact
        label={m.uploadedBy}
        value={`${item.uploader_name ?? m.unknownUploader} · ${formatRelative(item.created_at)}`}
      />
      <Fact label={m.usedIn} value={format(m.usedCount, { count: item.usage_count })} />
      <Divider />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          startIcon={<CopyIcon />}
          onClick={() => {
            void copyUrl(item.url);
          }}
        >
          {m.copyUrl}
        </Button>
        <Button startIcon={<DownloadIcon />} component="a" href={item.url} download={item.filename}>
          {m.download}
        </Button>
      </Box>
      {editable ? (
        <MediaDeleteContainer item={item} isAdmin={viewer.role === 'admin'} onDeleted={onClose} />
      ) : null}
    </Stack>
  );
}

// 03-DESIGN 20.3
export function MediaDetailsContainer({ id, onClose }: MediaDetailsProps) {
  const query = useQuery({ queryKey: ['media', 'detail', id], queryFn: () => getMedia(id) });
  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 400, maxWidth: '100%', p: 3 } } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="titleLarge" component="h2" noWrap>
          {query.data?.filename}
        </Typography>
        <IconButton aria-label={m.drawerClose} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <QueryBoundary query={query}>
        {(item) => <Details item={item} onClose={onClose} />}
      </QueryBoundary>
    </Drawer>
  );
}
