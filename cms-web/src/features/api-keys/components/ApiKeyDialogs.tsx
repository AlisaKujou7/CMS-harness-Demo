import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormBanner } from '../../../design-system/components/FormBanner';
import { CopyIcon } from '../../../design-system/icons';
import { common } from '../../../shared/i18n/common.messages';
import { apiKeyMessages as m } from '../api-keys.messages';

const schema = z.object({ name: z.string().trim().min(1, m.nameRequired) });
type NameValues = z.infer<typeof schema>;

export interface CreateKeyDialogProps {
  readonly pending: boolean;
  readonly error: string | null;
  onSubmit(name: string): void;
  onClose(): void;
}

export function CreateKeyDialog({ pending, error, onSubmit, onClose }: CreateKeyDialogProps) {
  const titleId = useId();
  const { register, handleSubmit, formState } = useForm<NameValues>({
    resolver: zodResolver(schema),
  });
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>{m.createTitle}</DialogTitle>
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(({ name }) => {
            onSubmit(name);
          })(event);
        }}
      >
        <DialogContent>
          {error === null ? null : <FormBanner message={error} />}
          <TextField
            {...register('name')}
            sx={{ mt: 1 }}
            label={m.name}
            error={formState.errors.name !== undefined}
            helperText={formState.errors.name?.message}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose}>{common.cancel}</Button>
          <Button type="submit" variant="contained" loading={pending}>
            {m.create}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export interface ShowKeyDialogProps {
  readonly apiKey: string;
  onCopy(): void;
  onClose(): void;
}

// 03-DESIGN 12.8. Pressing outside does not close it, since the key can never be shown again.
export function ShowKeyDialog({ apiKey, onCopy, onClose }: ShowKeyDialogProps) {
  const titleId = useId();
  return (
    <Dialog open aria-labelledby={titleId} fullWidth maxWidth="sm">
      <DialogTitle id={titleId}>{m.shownOnceTitle}</DialogTitle>
      <DialogContent>
        <FormBanner tone="warning" message={m.shownOnceWarning} />
        <TextField
          label={m.shownOnceTitle}
          value={apiKey}
          slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace' } } }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button startIcon={<CopyIcon />} onClick={onCopy}>
          {m.copy}
        </Button>
        <Button variant="contained" onClick={onClose}>
          {m.done}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
