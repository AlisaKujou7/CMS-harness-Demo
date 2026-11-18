import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useId, useState } from 'react';
import { CheckIcon, FilterIcon, SearchIcon } from '../../../design-system/icons';
import type { ParamChanges } from '../../../shared/hooks/useQueryParams';
import type { AuthorOption } from '../content-filters';
import { contentMessages as m } from '../content.messages';

const STATUS_CHIPS = ['draft', 'in_review', 'published', 'unpublished', 'archived'] as const;
const PAGE_SIZES = ['10', '25', '50', '100'];
const DATE_SLOT = { inputLabel: { shrink: true } };

export interface ContentFiltersProps {
  readonly params: URLSearchParams;
  readonly search: string;
  readonly authors: readonly AuthorOption[];
  onSearch(value: string): void;
  onChange(changes: ParamChanges): void;
}

function FilterChip(props: {
  readonly label: string;
  readonly selected: boolean;
  onClick(): void;
}) {
  const { label, selected, onClick } = props;
  return (
    <Chip
      label={label}
      clickable
      aria-pressed={selected}
      variant={selected ? 'filled' : 'outlined'}
      sx={selected ? { bgcolor: 'md.secondaryContainer', color: 'md.onSecondaryContainer' } : {}}
      {...(selected ? { icon: <CheckIcon fontSize="small" /> } : {})}
      onClick={onClick}
    />
  );
}

function MoreFilters({
  params,
  authors,
  onChange,
  onClose,
}: Omit<ContentFiltersProps, 'search' | 'onSearch'> & { onClose(): void }) {
  const titleId = useId();
  const bind = (name: string) => ({
    value: params.get(name) ?? '',
    onChange: (event: { target: { value: string } }) => {
      onChange({ [name]: event.target.value });
    },
  });
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>{m.list.filtersTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label={m.list.author} {...bind('author')}>
            <MenuItem value="">{m.list.anyAuthor}</MenuItem>
            {authors.map((author) => (
              <MenuItem key={author.id} value={author.id}>
                {author.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={m.list.tag} {...bind('tag')} />
          <TextField type="date" label={m.list.from} slotProps={DATE_SLOT} {...bind('from')} />
          <TextField type="date" label={m.list.to} slotProps={DATE_SLOT} {...bind('to')} />
          <TextField
            select
            label={m.list.pageSize}
            {...bind('size')}
            value={params.get('size') ?? '25'}
          >
            {PAGE_SIZES.map((size) => (
              <MenuItem key={size} value={size}>
                {size}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button variant="contained" onClick={onClose}>
          {m.list.apply}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// 03-DESIGN 12.3
export function ContentFilters(props: ContentFiltersProps) {
  const { params, search, onSearch, onChange, authors } = props;
  const [more, setMore] = useState(false);
  const status = params.get('status');
  const toggle = (name: string) => () => {
    onChange({ [name]: params.get(name) === '1' ? undefined : '1' });
  };
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
      <TextField
        size="small"
        label={m.list.search}
        value={search}
        sx={{ width: 280 }}
        onChange={(event) => {
          onSearch(event.target.value);
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <FilterChip
          label={m.list.all}
          selected={status === null}
          onClick={() => {
            onChange({ status: undefined });
          }}
        />
        {STATUS_CHIPS.map((value) => (
          <FilterChip
            key={value}
            label={m.statuses[value]}
            selected={status === value}
            onClick={() => {
              onChange({ status: value });
            }}
          />
        ))}
        <FilterChip
          label={m.list.mine}
          selected={params.get('mine') === '1'}
          onClick={toggle('mine')}
        />
        <FilterChip
          label={m.list.recent}
          selected={params.get('recent') === '1'}
          onClick={toggle('recent')}
        />
        <Button
          size="small"
          startIcon={<FilterIcon />}
          onClick={() => {
            setMore(true);
          }}
        >
          {m.list.more}
        </Button>
      </Box>
      {more ? (
        <MoreFilters
          params={params}
          authors={authors}
          onChange={onChange}
          onClose={() => {
            setMore(false);
          }}
        />
      ) : null}
    </Box>
  );
}
