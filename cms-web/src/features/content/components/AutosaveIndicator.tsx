import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { format } from '../../../shared/i18n/format';
import { formatRelative } from '../../../shared/utils/time';
import { contentMessages as m } from '../content.messages';

export type IndicatorState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly at: Date }
  | { readonly kind: 'retrying' }
  | { readonly kind: 'error' };

export interface AutosaveIndicatorProps {
  readonly state: IndicatorState;
  readonly now: Date;
}

function label({ state, now }: AutosaveIndicatorProps): string {
  switch (state.kind) {
    case 'saving':
      return m.editor.saving;
    case 'saved':
      return format(m.editor.savedAgo, { ago: formatRelative(state.at, now) });
    case 'retrying':
      return m.editor.retrying;
    case 'error':
      return m.editor.saveFailed;
    default:
      return '';
  }
}

// 03-DESIGN 19.4. A polite live region, so a failure is heard without interrupting anyone typing.
export function AutosaveIndicator(props: AutosaveIndicatorProps) {
  const { kind } = props.state;
  const failing = kind === 'retrying' || kind === 'error';
  return (
    <Typography
      role="status"
      variant="bodySmall"
      component="p"
      sx={{ minHeight: 20, color: failing ? 'error.main' : 'text.secondary' }}
    >
      {kind === 'saving' ? <CircularProgress size={12} sx={{ mr: 1 }} aria-hidden /> : null}
      {label(props)}
    </Typography>
  );
}
