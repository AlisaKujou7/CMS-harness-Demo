import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useId, useState } from 'react';

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly destructive?: boolean;
  readonly pending?: boolean;
  // 03-DESIGN 13.5: an irreversible action asks for the resource's name first.
  readonly requireText?: string;
  readonly requireTextLabel?: string;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    open,
    title,
    body,
    confirmLabel,
    cancelLabel,
    destructive = false,
    pending = false,
  } = props;
  const { requireText, requireTextLabel, onConfirm, onCancel } = props;
  const titleId = useId();
  const [typed, setTyped] = useState('');
  const blocked = pending || (requireText !== undefined && typed !== requireText);
  const close = () => {
    setTyped('');
    onCancel();
  };

  return (
    <Dialog open={open} onClose={close} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId} variant="headlineSmall">
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText variant="bodyMedium">{body}</DialogContentText>
        {requireText === undefined ? null : (
          <TextField
            sx={{ mt: 2 }}
            label={requireTextLabel}
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={close}>{cancelLabel}</Button>
        <Button
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          disabled={blocked}
          loading={pending}
          onClick={() => {
            setTyped('');
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
