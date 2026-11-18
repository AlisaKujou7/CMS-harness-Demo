import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useId, useState } from 'react';
import { common } from '../../../../shared/i18n/common.messages';
import { contentMessages as m } from '../../content.messages';
import { isSafeLink } from '../../rich-text';

export interface LinkValues {
  readonly href: string;
  readonly text: string;
  readonly newTab: boolean;
}

export interface LinkDialogProps {
  readonly initial: LinkValues;
  readonly canRemove: boolean;
  onApply(values: LinkValues): void;
  onRemove(): void;
  onClose(): void;
}

// 03-DESIGN 19.3
export function LinkDialog({ initial, canRemove, onApply, onRemove, onClose }: LinkDialogProps) {
  const titleId = useId();
  const [href, setHref] = useState(initial.href);
  const [text, setText] = useState(initial.text);
  const [newTab, setNewTab] = useState(initial.newTab);
  const [touched, setTouched] = useState(false);
  const valid = isSafeLink(href);
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>{m.link.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={m.link.url}
            value={href}
            error={touched && !valid}
            helperText={touched && !valid ? m.link.invalid : undefined}
            onChange={(event) => {
              setHref(event.target.value);
            }}
            onBlur={() => {
              setTouched(true);
            }}
          />
          <TextField
            label={m.link.text}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
          <FormControlLabel
            label={m.link.newTab}
            control={
              <Checkbox
                checked={newTab}
                onChange={(event) => {
                  setNewTab(event.target.checked);
                }}
              />
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        {canRemove ? <Button onClick={onRemove}>{m.link.remove}</Button> : null}
        <Button onClick={onClose}>{common.cancel}</Button>
        <Button
          variant="contained"
          disabled={!valid}
          onClick={() => {
            onApply({ href, text, newTab });
          }}
        >
          {m.link.apply}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
