import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ErrorIcon, InfoIcon, WarningIcon } from '../icons';

export type BannerTone = 'error' | 'info' | 'warning';

export interface FormBannerProps {
  readonly message: string;
  readonly tone?: BannerTone;
}

const TONES = {
  error: { bg: 'md.errorContainer', fg: 'md.onErrorContainer', Icon: ErrorIcon, role: 'alert' },
  info: {
    bg: 'md.secondaryContainer',
    fg: 'md.onSecondaryContainer',
    Icon: InfoIcon,
    role: 'status',
  },
  warning: {
    bg: 'md.tertiaryContainer',
    fg: 'md.onTertiaryContainer',
    Icon: WarningIcon,
    role: 'status',
  },
} as const;

// 03-DESIGN 14.3 and 15.2
export function FormBanner({ message, tone = 'error' }: FormBannerProps) {
  const { bg, fg, Icon, role } = TONES[tone];
  return (
    <Box
      role={role}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        mb: 2,
        borderRadius: 1,
        bgcolor: bg,
        color: fg,
      }}
    >
      <Icon fontSize="small" aria-hidden />
      <Typography variant="bodyMedium">{message}</Typography>
    </Box>
  );
}
