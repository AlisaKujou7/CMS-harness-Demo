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

function acceptable(files: readonly File[]): readonly File[] {
  return files.filter((file) => {
    const problem = validateFile(file);
    if (problem !== null) notify.error(problem);
    return problem === null;
  });
}

export interface MediaUpload {
  readonly progress: UploadSummary | null;
  start(files: readonly File[]): void;
}

// Files chosen during an upload wait their turn, so nothing already on its way is dropped.
export function useMediaUpload(onUploaded?: (items: readonly MediaRow[]) => void): MediaUpload {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadSummary | null>(null);
  const subscription = useRef<Subscription | null>(null);
  const waiting = useRef<File[]>([]);

  useEffect(
    () => () => {
      waiting.current = [];
      subscription.current?.unsubscribe();
    },
    [],
  );

  const sendNext = useCallback(() => {
    const batch = waiting.current;
    waiting.current = [];
    let latest: UploadSummary | null = null;
    subscription.current = uploadProgress$(batch, DEPS).subscribe({
      next: (summary) => {
        latest = summary;
        setProgress(summary);
      },
      complete: () => {
        subscription.current = null;
        setProgress(null);
        if (latest !== null) {
          announce(latest);
          void queryClient.invalidateQueries({ queryKey: ['media'] });
          onUploaded?.(latest.items);
        }
        if (waiting.current.length > 0) sendNext();
      },
    });
  }, [queryClient, onUploaded]);

  const start = useCallback(
    (files: readonly File[]) => {
      const valid = acceptable(files);
      if (valid.length === 0) return;
      waiting.current = [...waiting.current, ...valid];
      if (subscription.current === null) sendNext();
    },
    [sendNext],
  );

  return { progress, start };
}
