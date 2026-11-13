import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../../../design-system/components/ConfirmDialog';
import { Crumbs } from '../../../design-system/components/Crumbs';
import { EmptyState } from '../../../design-system/components/EmptyState';
import { FormBanner } from '../../../design-system/components/FormBanner';
import { AuditIcon } from '../../../design-system/icons';
import type { ContentDetail, ContentType, ContentVersionDetail } from '../../../shared/api/types';
import { QueryBoundary } from '../../../shared/components/QueryBoundary';
import { common } from '../../../shared/i18n/common.messages';
import { format } from '../../../shared/i18n/format';
import { notify } from '../../../shared/stores/ui.store';
import { formatDateTime } from '../../../shared/utils/time';
import { getVersion, listVersions, revertContent } from '../api/content.api';
import { DocPreview } from '../components/DocPreview';
import { contentMessages as m } from '../content.messages';
import { useResolvedBody } from '../hooks/useResolvedBody';
import { missingImages } from '../rich-text';
import { editorPath, listPath, type RichTextDoc } from '../types/content.types';

const h = m.history;

function reportRevert(version: number, snapshot: RichTextDoc, result: ContentDetail): void {
  const count = missingImages(snapshot, result.body as RichTextDoc);
  notify.success(
    count === 0
      ? format(m.toasts.reverted, { version })
      : format(m.toasts.droppedMedia, { version, count }),
  );
}

function VersionPreview({
  detail,
  onRevert,
}: {
  readonly detail: ContentVersionDetail;
  onRevert(): void;
}) {
  const body = useResolvedBody(detail.snapshot.body as RichTextDoc);
  return (
    <Card variant="outlined">
      <CardContent>
        <FormBanner tone="warning" message={h.warning} />
        <Typography variant="headlineSmall" component="h2">
          {detail.snapshot.title}
        </Typography>
        {body === null ? null : <DocPreview doc={body} />}
        <Button variant="contained" sx={{ mt: 2 }} onClick={onRevert}>
          {h.revert}
        </Button>
      </CardContent>
    </Card>
  );
}

export interface VersionHistoryPageProps {
  readonly type: ContentType;
}

// 03-DESIGN 19.5 and FR-CONTENT-09
export function VersionHistoryPage({ type }: VersionHistoryPageProps) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const versions = useQuery({
    queryKey: ['content', 'versions', id],
    queryFn: () => listVersions(id),
  });
  const detail = useQuery({
    queryKey: ['content', 'versions', id, selected],
    queryFn: () => getVersion(id, selected ?? 0),
    enabled: selected !== null,
  });
  const revert = useMutation({
    mutationFn: (version: ContentVersionDetail) => revertContent(id, version.version_no),
    onSuccess: async (result, version) => {
      reportRevert(version.version_no, version.snapshot.body as RichTextDoc, result);
      await queryClient.invalidateQueries({ queryKey: ['content'] });
      void navigate(editorPath(type, id));
    },
  });
  return (
    <>
      <Crumbs
        label={m.crumbsLabel}
        items={[
          { label: m.plural[type], href: listPath(type) },
          { label: h.backToEditor, href: editorPath(type, id) },
          { label: h.title },
        ]}
      />
      <Typography variant="headlineLarge" component="h1" sx={{ display: 'block', mb: 3 }}>
        {h.title}
      </Typography>
      <QueryBoundary query={versions}>
        {({ data }) =>
          data.length === 0 ? (
            <EmptyState icon={<AuditIcon />} title={h.empty} />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: { md: '1fr 2fr' },
                alignItems: 'start',
              }}
            >
              <Card variant="outlined">
                <List component="nav" aria-label={h.versions}>
                  {data.map((version) => (
                    <ListItemButton
                      key={version.id}
                      selected={selected === version.version_no}
                      onClick={() => {
                        setSelected(version.version_no);
                      }}
                    >
                      <ListItemText
                        primary={format(h.version, { version: version.version_no })}
                        secondary={`${formatDateTime(version.created_at)} · ${version.editor_name ?? h.unknownEditor}`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Card>
              {selected === null ? (
                <Typography variant="bodyMedium" color="text.secondary">
                  {h.select}
                </Typography>
              ) : (
                <QueryBoundary query={detail}>
                  {(version) => (
                    <VersionPreview
                      detail={version}
                      onRevert={() => {
                        setConfirming(true);
                      }}
                    />
                  )}
                </QueryBoundary>
              )}
            </Box>
          )
        }
      </QueryBoundary>
      <ConfirmDialog
        open={confirming}
        title={format(h.revertTitle, { version: selected ?? 0 })}
        body={h.revertBody}
        confirmLabel={h.revert}
        cancelLabel={common.cancel}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          if (detail.data) revert.mutate(detail.data);
        }}
      />
    </>
  );
}
