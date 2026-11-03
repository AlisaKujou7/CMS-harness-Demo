import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import { type Column, DataTable } from '../../../design-system/components/DataTable';
import type { MediaRow, Pagination } from '../../../shared/api/types';
import { Pager } from '../../../shared/components/Pager';
import { format } from '../../../shared/i18n/format';
import { MediaTile } from '../../../shared/media/MediaTile';
import { formatBytes } from '../../../shared/utils/bytes';
import { formatRelative } from '../../../shared/utils/time';
import { libraryMessages as m } from '../media-library.messages';
import type { MediaView } from './MediaFilters';

export interface MediaResultsProps {
  readonly rows: readonly MediaRow[];
  readonly pagination: Pagination;
  readonly view: MediaView;
  readonly selected: ReadonlySet<string>;
  onOpen(item: MediaRow): void;
  onToggle(item: MediaRow): void;
  onPage(page: number): void;
}

export function MediaResults(props: MediaResultsProps) {
  const { rows, pagination, view, selected, onOpen, onToggle, onPage } = props;
  const pager = <Pager pagination={pagination} onPage={onPage} />;
  if (view === 'grid') {
    return (
      <>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          {rows.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              checked={selected.has(item.id)}
              checkLabel={format(m.select, { name: item.filename })}
              onOpen={onOpen}
              onCheck={onToggle}
            />
          ))}
        </Box>
        {pager}
      </>
    );
  }
  const columns: readonly Column<MediaRow>[] = [
    {
      key: 'select',
      header: m.select.replace(' {name}', ''),
      hideHeader: true,
      render: (item) => (
        <Checkbox
          checked={selected.has(item.id)}
          slotProps={{ input: { 'aria-label': format(m.select, { name: item.filename }) } }}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onChange={() => {
            onToggle(item);
          }}
        />
      ),
    },
    { key: 'name', header: m.filename, render: (item) => item.filename },
    { key: 'size', header: m.size, render: (item) => formatBytes(item.size_bytes) },
    { key: 'by', header: m.uploadedBy, render: (item) => item.uploader_name ?? m.unknownUploader },
    { key: 'at', header: m.uploaded, render: (item) => formatRelative(item.created_at) },
  ];
  return (
    <DataTable
      caption={m.caption}
      columns={columns}
      rows={rows}
      rowKey={(item) => item.id}
      onRowClick={onOpen}
      footer={pager}
    />
  );
}
