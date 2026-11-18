import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useId, useState } from 'react';
import { common } from '../../../shared/i18n/common.messages';
import { fromLocalInput, toLocalInput } from '../../../shared/utils/time';
import { contentMessages as m } from '../content.messages';

export interface ScheduleDialogProps {
  readonly now: Date;
  onSubmit(at: string): void;
  onClose(): void;
}

const HOUR_MS = 3_600_000;

// 03-DESIGN 12.4
export function ScheduleDialog({ now, onSubmit, onClose }: ScheduleDialogProps) {
  const titleId = useId();
  const [value, setValue] = useState(() => toLocalInput(new Date(now.getTime() + HOUR_MS)));
  const inFuture = value !== '' && new Date(value) > now;
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>{m.schedule.title}</DialogTitle>
      <DialogContent>
        <TextField
          sx={{ mt: 1 }}
          type="datetime-local"
          label={m.schedule.when}
          value={value}
          error={!inFuture}
          helperText={inFuture ? undefined : m.schedule.mustBeFuture}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>{common.cancel}</Button>
        <Button
          variant="contained"
          disabled={!inFuture}
          onClick={() => {
            onSubmit(fromLocalInput(value));
          }}
        >
          {m.schedule.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export interface RejectDialogProps {
  onSubmit(note: string): void;
  onClose(): void;
}

export function RejectDialog({ onSubmit, onClose }: RejectDialogProps) {
  const titleId = useId();
  const [note, setNote] = useState('');
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>{m.reject.title}</DialogTitle>
      <DialogContent>
        <TextField
          sx={{ mt: 1 }}
          multiline
          minRows={3}
          label={m.reject.note}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>{common.cancel}</Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            onSubmit(note);
          }}
        >
          {m.reject.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export interface ConflictDialogProps {
  readonly body: string;
  readonly saving: boolean;
  onReload(): void;
  onSaveCopy(): void;
}

// 03-DESIGN 19.4. There is no way to dismiss it, since either choice is the only way forward.
export function ConflictDialog({ body, saving, onReload, onSaveCopy }: ConflictDialogProps) {
  const titleId = useId();
  return (
    <Dialog open aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>{m.conflict.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{body}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button loading={saving} onClick={onSaveCopy}>
          {m.conflict.saveCopy}
        </Button>
        <Button variant="contained" onClick={onReload}>
          {m.conflict.reload}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
