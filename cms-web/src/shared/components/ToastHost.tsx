import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import { CloseIcon } from '../../design-system/icons';
import { common } from '../i18n/common.messages';
import { useUiStore } from '../stores/ui.store';

// 03-DESIGN 10.9 and 17.3: one at a time, and errors interrupt where the rest wait politely.
export function ToastHost() {
  const toast = useUiStore((state) => state.toasts[0]);
  const dismiss = useUiStore((state) => state.dismissToast);
  if (toast === undefined) return null;

  const close = () => {
    dismiss(toast.id);
  };
  const action = toast.action;
  return (
    <Snackbar
      key={toast.id}
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      autoHideDuration={toast.durationMs}
      onClose={(_event, reason) => {
        if (reason !== 'clickaway') close();
      }}
      message={toast.message}
      slotProps={{
        content: {
          role: toast.severity === 'error' ? 'alert' : 'status',
          sx: { bgcolor: 'md.inverseSurface', color: 'md.inverseOnSurface' },
        },
      }}
      action={
        <>
          {action ? (
            <Button
              size="small"
              sx={{ color: 'md.inversePrimary' }}
              onClick={() => {
                action.run();
                close();
              }}
            >
              {action.label}
            </Button>
          ) : null}
          <IconButton
            size="small"
            aria-label={common.close}
            sx={{ color: 'md.inverseOnSurface' }}
            onClick={close}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </>
      }
    />
  );
}
