import Chip from '@mui/material/Chip';
import { visuallyHidden } from '@mui/utils';
import { format } from '../../../shared/i18n/format';
import { contentMessages as m } from '../content.messages';
import type { DisplayStatus } from '../types/content.types';

// 03-DESIGN 6.2
const COLORS: Readonly<Record<DisplayStatus, { readonly bg: string; readonly fg: string }>> = {
  draft: { bg: 'md.surfaceContainerHigh', fg: 'md.onSurfaceVariant' },
  in_review: { bg: 'md.tertiaryContainer', fg: 'md.onTertiaryContainer' },
  scheduled: { bg: 'md.secondaryContainer', fg: 'md.onSecondaryContainer' },
  published: { bg: 'md.successContainer', fg: 'md.onSuccessContainer' },
  unpublished: { bg: 'md.outlineVariant', fg: 'md.onSurfaceVariant' },
  archived: { bg: 'md.surfaceContainer', fg: 'md.onSurfaceVariant' },
};

export interface StatusChipProps {
  readonly status: DisplayStatus;
}

// 03-DESIGN 17.3 and 17.4: the text carries the meaning, and the color only reinforces it.
export function StatusChip({ status }: StatusChipProps) {
  const label = m.statuses[status];
  const { bg, fg } = COLORS[status];
  return (
    <Chip
      size="small"
      sx={{
        bgcolor: bg,
        color: fg,
        borderRadius: 9999,
        fontStyle: status === 'archived' ? 'italic' : 'normal',
      }}
      label={
        <>
          <span aria-hidden>{label}</span>
          <span style={visuallyHidden}>{format(m.statusForReaders, { status: label })}</span>
        </>
      }
    />
  );
}
