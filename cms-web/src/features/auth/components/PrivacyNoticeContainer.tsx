import { useState } from 'react';
import { ConfirmDialog } from '../../../design-system/components/ConfirmDialog';
import { common } from '../../../shared/i18n/common.messages';
import { readPreference, writePreference } from '../../../shared/persistence/preferences';
import { useCurrentUser } from '../../../shared/stores/session.store';
import { authMessages as m } from '../auth.messages';

const keyFor = (userId: string) => `privacy-notice.${userId}`;

// 02-SRS 10.1. Remembered per browser (ADR-0013), so it can show again on a new device.
export function PrivacyNoticeContainer() {
  const { id } = useCurrentUser();
  const [seen, setSeen] = useState(() => readPreference(keyFor(id)) !== null);
  const accept = () => {
    writePreference(keyFor(id), new Date().toISOString());
    setSeen(true);
  };
  return (
    <ConfirmDialog
      open={!seen}
      title={m.privacyTitle}
      body={m.privacyBody}
      confirmLabel={m.privacyAccept}
      cancelLabel={common.close}
      onConfirm={accept}
      onCancel={accept}
    />
  );
}
