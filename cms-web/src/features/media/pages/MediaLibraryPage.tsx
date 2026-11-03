import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type DragEvent, useEffect, useState } from 'react';
import { ConfirmDialog } from '../../../design-system/components/ConfirmDialog';
import { EmptyState } from '../../../design-system/components/EmptyState';
import { PageHeader } from '../../../design-system/components/PageHeader';
import { MediaIcon } from '../../../design-system/icons';
import { QueryBoundary } from '../../../shared/components/QueryBoundary';
import { useClampPage } from '../../../shared/hooks/useClampPage';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { useQueryParams } from '../../../shared/hooks/useQueryParams';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { listMedia } from '../../../shared/media/media.api';
import { UploadBanner } from '../../../shared/media/UploadBanner';
import { UploadButton } from '../../../shared/media/UploadButton';
import { pollWhileProcessing } from '../../../shared/media/useMedia';
import { useMediaUpload } from '../../../shared/media/useMediaUpload';
import { useCurrentUser } from '../../../shared/stores/session.store';
import { MediaDetailsContainer } from '../components/MediaDetailsContainer';
import { MediaFilters, type MediaView } from '../components/MediaFilters';
import { MediaResults } from '../components/MediaResults';
import { useBulkDelete } from '../hooks/useBulkDelete';
import { hasMediaFilters, toggled, toMediaFilter } from '../media-filters';
import { libraryMessages as m } from '../media-library.messages';

const SEARCH_DEBOUNCE_MS = 300;
const NOTHING: ReadonlySet<string> = new Set();

function DropZone({ onFiles }: { onFiles(files: readonly File[]): void }) {
  const [over, setOver] = useState(false);
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    onFiles([...event.dataTransfer.files]);
  };
  return (
    <Box
      data-testid="drop-zone"
      onDragEnter={() => {
        setOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDragLeave={() => {
        setOver(false);
      }}
      onDrop={drop}
      sx={{
        p: over ? 4 : 1,
        mb: 2,
        textAlign: 'center',
        border: 2,
        borderStyle: 'dashed',
        borderColor: over ? 'primary.main' : 'divider',
        borderRadius: 1,
      }}
    >
      <Typography variant="bodyMedium" color="text.secondary">
        {m.dropHere}
      </Typography>
    </Box>
  );
}

// 03-DESIGN 12.5 and 20.1
export function MediaLibraryPage() {
  const viewer = useCurrentUser();
  const { params, update, setPage } = useQueryParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const settled = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [view, setView] = useState<MediaView>('grid');
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState(NOTHING);
  const [confirming, setConfirming] = useState(false);
  const filter = toMediaFilter(params, viewer.id);
  const upload = useMediaUpload();
  const bulk = useBulkDelete(() => {
    setSelected(NOTHING);
  });
  const query = useQuery({
    queryKey: ['media', 'list', filter],
    queryFn: () => listMedia(filter),
    placeholderData: keepPreviousData,
    refetchInterval: (state) => pollWhileProcessing(state.state.data),
  });
  useClampPage(query.data, setPage);
  // A selection means what is on screen, because deleting cannot be undone.
  const listing = params.toString();
  useEffect(() => {
    setSelected(NOTHING);
  }, [listing]);
  useEffect(() => {
    if (settled !== (params.get('search') ?? '')) update({ search: settled });
    // Only a settled change writes the URL. A URL change is not a reason to write it back.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- See above.
  }, [settled]);

  return (
    <>
      <PageHeader
        title={m.title}
        action={<UploadButton label={m.upload} onFiles={upload.start} />}
      />
      <MediaFilters
        params={params}
        search={search}
        view={view}
        onSearch={setSearch}
        onChange={update}
        onView={setView}
      />
      <DropZone onFiles={upload.start} />
      <UploadBanner progress={upload.progress} />
      {selected.size > 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="bodyMedium">
            {format(m.selected, { count: selected.size })}
          </Typography>
          <Button
            color="error"
            onClick={() => {
              setConfirming(true);
            }}
          >
            {m.bulkDelete}
          </Button>
        </Box>
      ) : null}
      <QueryBoundary query={query}>
        {({ data, pagination }) =>
          data.length === 0 ? (
            <EmptyState
              icon={<MediaIcon />}
              title={hasMediaFilters(params) ? m.noMatch : m.empty}
              {...(hasMediaFilters(params) ? {} : { description: m.emptyHint })}
            />
          ) : (
            <MediaResults
              rows={data}
              pagination={pagination}
              view={view}
              selected={selected}
              onOpen={(item) => {
                setOpen(item.id);
              }}
              onToggle={(item) => {
                setSelected((ids) => toggled(ids, item.id));
              }}
              onPage={setPage}
            />
          )
        }
      </QueryBoundary>
      {open === null ? null : (
        <MediaDetailsContainer
          id={open}
          onClose={() => {
            setOpen(null);
          }}
        />
      )}
      <ConfirmDialog
        open={confirming}
        destructive
        title={format(m.bulkTitle, { count: selected.size })}
        body={m.bulkBody}
        confirmLabel={common.delete}
        cancelLabel={common.cancel}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          bulk.mutate([...selected]);
        }}
      />
    </>
  );
}
