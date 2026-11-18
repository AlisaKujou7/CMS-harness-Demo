import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { CheckIcon, DocumentIcon } from '../../design-system/icons';
import type { MediaRow } from '../api/types';
import { mediaMessages as m } from './media.messages';
import { isImageMedia } from './media-validation';

export interface MediaTileProps {
  readonly item: MediaRow;
  readonly selected?: boolean;
  readonly checkLabel?: string;
  readonly checked?: boolean;
  onOpen(item: MediaRow): void;
  onCheck?(item: MediaRow): void;
}

const TILE_PX = 160;

function Preview({ item }: { readonly item: MediaRow }) {
  if (!isImageMedia(item.mime_type)) return <DocumentIcon sx={{ fontSize: 48 }} aria-hidden />;
  if (item.variant_status === 'pending') return <CircularProgress aria-label={m.processing} />;
  return (
    <img
      loading="lazy"
      src={item.variants['thumbnail']?.url ?? item.url}
      alt={item.alt_text ?? ''}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

// 03-DESIGN 12.5 and 20.2
export function MediaTile(props: MediaTileProps) {
  const { item, selected = false, checkLabel, checked = false, onOpen, onCheck } = props;
  return (
    <Card
      variant="outlined"
      sx={{
        width: TILE_PX,
        position: 'relative',
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
      }}
    >
      <ButtonBase
        aria-pressed={selected}
        onClick={() => {
          onOpen(item);
        }}
        sx={{ display: 'block', width: '100%', textAlign: 'left' }}
      >
        <Box
          sx={{
            height: TILE_PX,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'md.surfaceContainer',
          }}
        >
          <Preview item={item} />
        </Box>
        <Tooltip title={item.filename}>
          <Typography variant="labelMedium" noWrap sx={{ display: 'block', p: 1 }}>
            {item.filename}
          </Typography>
        </Tooltip>
      </ButtonBase>
      {selected ? (
        <CheckIcon
          color="primary"
          titleAccess={m.selected}
          sx={{ position: 'absolute', top: 8, right: 8 }}
        />
      ) : null}
      {onCheck === undefined ? null : (
        <Checkbox
          checked={checked}
          slotProps={{ input: { 'aria-label': checkLabel } }}
          sx={{ position: 'absolute', top: 0, left: 0 }}
          onChange={() => {
            onCheck(item);
          }}
        />
      )}
    </Card>
  );
}
