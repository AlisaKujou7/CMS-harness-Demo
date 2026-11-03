import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { format } from '../i18n/format';
import { mediaMessages as m } from './media.messages';
import type { UploadSummary } from './upload.stream';

export interface UploadBannerProps {
  readonly progress: UploadSummary | null;
}

// 03-DESIGN 20.1
export function UploadBanner({ progress }: UploadBannerProps) {
  if (progress === null) return null;
  const { finished, total, percent } = progress;
  const label = format(m.uploading, { done: Math.min(finished + 1, total), total, percent });
  return (
    <Box role="status" sx={{ mb: 2 }}>
      <Typography variant="bodyMedium">{label}</Typography>
      <LinearProgress variant="determinate" value={percent} aria-label={label} />
    </Box>
  );
}
