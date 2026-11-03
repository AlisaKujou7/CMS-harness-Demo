import Button from '@mui/material/Button';
import { FormBanner } from '../../../design-system/components/FormBanner';
import type { ContentDetail } from '../../../shared/api/types';
import { format } from '../../../shared/i18n/format';
import { contentMessages as m } from '../content.messages';

export interface EditorBannersProps {
  readonly banner: string | null;
  readonly content: ContentDetail | null;
  readonly canEdit: boolean;
  readonly scheduledLabel: string | null;
  readonly canCancelSchedule: boolean;
  onCancelSchedule(): void;
}

// 03-DESIGN 15.2
export function EditorBanners(props: EditorBannersProps) {
  const { banner, content, canEdit, scheduledLabel, canCancelSchedule, onCancelSchedule } = props;
  const note = content?.status === 'draft' ? content.review_note : null;
  return (
    <>
      {banner === null ? null : <FormBanner message={banner} />}
      {canEdit ? null : <FormBanner tone="info" message={m.editor.readOnly} />}
      {note ? <FormBanner tone="warning" message={format(m.editor.reviewNote, { note })} /> : null}
      {scheduledLabel === null ? null : (
        <>
          <FormBanner
            tone="info"
            message={format(m.editor.scheduledBanner, { date: scheduledLabel })}
          />
          {canCancelSchedule ? (
            <Button size="small" sx={{ mb: 2 }} onClick={onCancelSchedule}>
              {m.editor.cancelSchedule}
            </Button>
          ) : null}
        </>
      )}
    </>
  );
}
