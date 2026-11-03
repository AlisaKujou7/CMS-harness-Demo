import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Subscription } from 'rxjs';
import type { MediaRow } from '../api/types';
import { format } from '../i18n/format';
import { notify } from '../stores/ui.store';
import { errorToMessage } from '../streams/global-errors.stream';
import { finalizeUpload, presignUpload } from './media.api';
import { mediaMessages as m } from './media.messages';
import { validateFile } from './media-validation';
import { putFile } from './upload-transport';
import { uploadProgress$, type UploadSummary } from './upload.stream';

const DEPS = { presign: presignUpload, put: putFile, finalize: finalizeUpload };

function announce(summary: UploadSummary): void {
  for (const { name, error } of summary.failures) {
    notify.error(format(m.uploadFailed, { name, reason: errorToMessage(error) }));
  }
  const count = summary.items.length;
  if (count === 1) notify.success(m.uploadedOne);
  if (count > 1) notify.success(format(m.uploaded, { count }));
}

export interface MediaUpload {
  readonly progress: UploadSummary | null;
  start(files: readonly File[]): void;
}

export function useMediaUpload(onUploaded?: (items: readonly MediaRow[]) => void): MediaUpload {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadSummary | null>(null);
  const subscription = useRef<Subscription | null>(null);

  useEffect(
    () => () => {
      subscription.current?.unsubscribe();
    },
    [],
  );

  const start = useCallback(
    (files: readonly File[]) => {
      const valid = files.filter((file) => {
        const problem = validateFile(file);
        if (problem !== null) notify.error(problem);
        return problem === null;
      });
      if (valid.length === 0) return;

      let latest: UploadSummary | null = null;
      subscription.current?.unsubscribe();
      subscription.current = uploadProgress$(valid, DEPS).subscribe({
        next: (summary) => {
          latest = summary;
          setProgress(summary);
        },
        complete: () => {
          setProgress(null);
          if (latest === null) return;
          announce(latest);
          void queryClient.invalidateQueries({ queryKey: ['media'] });
          onUploaded?.(latest.items);
        },
      });
    },
    [queryClient, onUploaded],
  );

  return { progress, start };
}
