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

function ScheduledBanner(props: Omit<EditorBannersProps, 'banner' | 'content' | 'canEdit'>) {
  const { scheduledLabel, canCancelSchedule, onCancelSchedule } = props;
  if (scheduledLabel === null) return null;
  return (
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
  );
}

// 03-DESIGN 15.2
export function EditorBanners({ banner, content, canEdit, ...schedule }: EditorBannersProps) {
  const note = content?.status === 'draft' ? content.review_note : null;
  const live = canEdit && content?.status === 'published';
  return (
    <>
      {banner === null ? null : <FormBanner message={banner} />}
      {canEdit ? null : <FormBanner tone="info" message={m.editor.readOnly} />}
      {live ? <FormBanner tone="warning" message={m.editor.liveNotice} /> : null}
      {note ? <FormBanner tone="warning" message={format(m.editor.reviewNote, { note })} /> : null}
      <ScheduledBanner {...schedule} />
    </>
  );
}
