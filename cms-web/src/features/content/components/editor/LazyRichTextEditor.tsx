import Skeleton from '@mui/material/Skeleton';
import { lazy, Suspense } from 'react';
import { contentMessages as m } from '../../content.messages';
import type { RichTextEditorProps } from './RichTextEditor';

const Editor = lazy(async () => ({
  default: (await import('./RichTextEditor')).RichTextEditor,
}));

// M-BUN-02: TipTap and ProseMirror load only when someone opens the editor.
export function LazyRichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={380} aria-label={m.toolbar.loading} />}>
      <Editor {...props} />
    </Suspense>
  );
}
