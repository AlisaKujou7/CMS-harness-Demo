import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { GridIcon, ListIcon } from '../../../design-system/icons';
import type { ParamChanges } from '../../../shared/hooks/useQueryParams';
import { libraryMessages as m } from '../media-library.messages';

export type MediaView = 'grid' | 'list';

export interface MediaFiltersProps {
  readonly params: URLSearchParams;
  readonly search: string;
  readonly view: MediaView;
  onSearch(value: string): void;
  onChange(changes: ParamChanges): void;
  onView(view: MediaView): void;
}

const DATE_SLOT = { inputLabel: { shrink: true } };

// 03-DESIGN 12.5 and FR-MEDIA-08
export function MediaFilters(props: MediaFiltersProps) {
  const { params, search, view, onSearch, onChange, onView } = props;
  const mine = params.get('mine') === '1';
  const bind = (name: string) => ({
    size: 'small' as const,
    fullWidth: false,
    value: params.get(name) ?? '',
    onChange: (event: { target: { value: string } }) => {
      onChange({ [name]: event.target.value });
    },
  });
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
      <TextField
        size="small"
        sx={{ width: 300 }}
        label={m.search}
        value={search}
        onChange={(event) => {
          onSearch(event.target.value);
        }}
      />
      <TextField select label={m.type} sx={{ minWidth: 140 }} {...bind('kind')}>
        <MenuItem value="">{m.allTypes}</MenuItem>
        <MenuItem value="image">{m.images}</MenuItem>
        <MenuItem value="document">{m.documents}</MenuItem>
      </TextField>
      <TextField type="date" label={m.from} slotProps={DATE_SLOT} {...bind('from')} />
      <TextField type="date" label={m.to} slotProps={DATE_SLOT} {...bind('to')} />
      <Chip
        label={m.mine}
        clickable
        aria-pressed={mine}
        variant={mine ? 'filled' : 'outlined'}
        onClick={() => {
          onChange({ mine: mine ? undefined : '1' });
        }}
      />
      <Box sx={{ ml: 'auto' }}>
        <IconButton
          aria-label={m.grid}
          aria-pressed={view === 'grid'}
          onClick={() => {
            onView('grid');
          }}
        >
          <GridIcon />
        </IconButton>
        <IconButton
          aria-label={m.list}
          aria-pressed={view === 'list'}
          onClick={() => {
            onView('list');
          }}
        >
          <ListIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
