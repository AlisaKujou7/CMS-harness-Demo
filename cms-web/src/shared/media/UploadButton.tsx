import Button from '@mui/material/Button';
import { visuallyHidden } from '@mui/utils';
import { UploadIcon } from '../../design-system/icons';
import { mediaMessages as m } from './media.messages';

export interface UploadButtonProps {
  readonly label: string;
  readonly variant?: 'contained' | 'outlined';
  onFiles(files: readonly File[]): void;
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf';

export function UploadButton({ label, variant = 'contained', onFiles }: UploadButtonProps) {
  return (
    <Button component="label" role={undefined} variant={variant} startIcon={<UploadIcon />}>
      {label}
      <input
        style={visuallyHidden}
        multiple
        type="file"
        accept={ACCEPT}
        aria-label={m.uploadInput}
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          event.target.value = '';
        }}
      />
    </Button>
  );
}
