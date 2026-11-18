import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useCallback, useId, useState } from 'react';
import { EmptyState } from '../../design-system/components/EmptyState';
import { MediaIcon } from '../../design-system/icons';
import type { MediaRow } from '../api/types';
import { QueryBoundary } from '../components/QueryBoundary';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { common } from '../i18n/common.messages';
import { mediaMessages as m } from './media.messages';
import { MediaTile } from './MediaTile';
import { UploadBanner } from './UploadBanner';
import { UploadButton } from './UploadButton';
import { useMediaList } from './useMedia';
import { useMediaUpload } from './useMediaUpload';

export interface MediaPickerProps {
  readonly open: boolean;
  onInsert(item: MediaRow): void;
  onClose(): void;
}

const SEARCH_DEBOUNCE_MS = 300;
const PICKER_PAGE_SIZE = 40;

// 03-DESIGN 20.2. Only images, since a content reference must be one (MEDIA_NOT_IMAGE).
export function MediaPickerContainer({ open, onInsert, onClose }: MediaPickerProps) {
  const titleId = useId();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MediaRow | null>(null);
  const debounced = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const query = useMediaList({ kind: 'image', search: debounced, page_size: PICKER_PAGE_SIZE });
  const onUploaded = useCallback((items: readonly MediaRow[]) => {
    setSelected(items[0] ?? null);
  }, []);
  const upload = useMediaUpload(onUploaded);

  return (
    <Dialog open={open} onClose={onClose} aria-labelledby={titleId} maxWidth="md" fullWidth>
      <DialogTitle id={titleId} variant="headlineSmall">
        {m.pickerTitle}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, pt: 1 }}>
          <TextField
            size="small"
            label={m.searchLabel}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
          <UploadButton label={m.uploadNew} variant="outlined" onFiles={upload.start} />
        </Box>
        <UploadBanner progress={upload.progress} />
        <QueryBoundary query={query}>
          {({ data }) =>
            data.length === 0 ? (
              <EmptyState icon={<MediaIcon />} title={m.empty} description={m.emptyHint} />
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {data.map((item) => (
                  <MediaTile
                    key={item.id}
                    item={item}
                    selected={selected?.id === item.id}
                    onOpen={setSelected}
                  />
                ))}
              </Box>
            )
          }
        </QueryBoundary>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>{common.cancel}</Button>
        <Button
          variant="contained"
          disabled={selected === null}
          onClick={() => {
            if (selected !== null) onInsert(selected);
          }}
        >
          {m.insert}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
