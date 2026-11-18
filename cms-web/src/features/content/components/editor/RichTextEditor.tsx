import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState } from 'react';
import type { MediaRow } from '../../../../shared/api/types';
import { MediaPickerContainer } from '../../../../shared/media/MediaPickerContainer';
import { contentMessages as m } from '../../content.messages';
import type { RichTextDoc } from '../../types/content.types';
import { EditorToolbar } from './EditorToolbar';
import { MediaImage } from './image-extension';
import { LinkDialog, type LinkValues } from './LinkDialog';

export interface RichTextEditorProps {
  readonly initial: RichTextDoc;
  readonly editable: boolean;
  onChange(doc: RichTextDoc): void;
  onBlur(): void;
}

// FR-CONTENT-15, and nothing the server's allow-list would remove on save.
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: { openOnClick: false, HTMLAttributes: { rel: null, target: null, class: null } },
  }),
  MediaImage,
];

const MOD_K = (event: KeyboardEvent) => (event.metaKey || event.ctrlKey) && event.key === 'k';

// 03-DESIGN 19.3: a new image is selected, so its alt text can be written straight away.
function selectImage(editor: Editor, mediaId: string): void {
  const positions: number[] = [];
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === 'image' && node.attrs['mediaId'] === mediaId) positions.push(position);
  });
  const newest = positions.at(-1);
  if (newest !== undefined) editor.commands.setNodeSelection(newest);
}

const sx = (fullscreen: boolean) => ({
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  bgcolor: 'md.surfaceContainerLow',
  ...(fullscreen ? { position: 'fixed', inset: 0, zIndex: 1300, overflow: 'auto' } : {}),
  '& .ProseMirror': { minHeight: 320, p: 2, outline: 'none', typography: 'bodyLarge' },
  '& .ProseMirror img': { maxWidth: '100%' },
  '& .ProseMirror img.ProseMirror-selectednode': {
    outline: '2px solid',
    outlineColor: 'primary.main',
  },
  '& .ProseMirror:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
});

// 03-DESIGN 19. Loaded on its own, so the rest of the app does not carry the editor's weight.
export function RichTextEditor({ initial, editable, onChange, onBlur }: RichTextEditorProps) {
  const [linking, setLinking] = useState(false);
  const [picking, setPicking] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const callbacks = useRef({ onChange, onBlur });
  callbacks.current = { onChange, onBlur };

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: initial,
    editable,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { 'aria-label': m.toolbar.body, role: 'textbox', 'aria-multiline': 'true' },
      handleKeyDown: (_view, event) => {
        if (!MOD_K(event)) return false;
        event.preventDefault();
        setLinking(true);
        return true;
      },
    },
    onUpdate: ({ editor: changed }) => {
      callbacks.current.onChange(changed.getJSON());
    },
    onBlur: () => {
      callbacks.current.onBlur();
    },
  });

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  const applyLink = ({ href, text, newTab }: LinkValues) => {
    const attrs = { href, target: newTab ? '_blank' : null };
    const chain = editor.chain().focus().extendMarkRange('link');
    if (text === '') chain.setLink(attrs).run();
    else chain.insertContent({ type: 'text', text, marks: [{ type: 'link', attrs }] }).run();
    setLinking(false);
  };
  const insertImage = (item: MediaRow) => {
    const attrs = { src: item.url, alt: item.alt_text ?? '', mediaId: item.id };
    editor.chain().focus().insertContent({ type: 'image', attrs }).run();
    selectImage(editor, item.id);
    setPicking(false);
  };
  const linkAttrs = editor.getAttributes('link') as { href?: string; target?: string | null };

  return (
    <Box sx={sx(fullscreen)}>
      <EditorToolbar
        editor={editor}
        fullscreen={fullscreen}
        disabled={!editable}
        onLink={() => {
          setLinking(true);
        }}
        onImage={() => {
          setPicking(true);
        }}
        onFullscreen={() => {
          setFullscreen((value) => !value);
        }}
      />
      {editable && editor.isActive('image') ? (
        <TextField
          size="small"
          sx={{ m: 1, width: 'calc(100% - 16px)', mt: 2 }}
          label={m.toolbar.imageAlt}
          value={String(editor.getAttributes('image')['alt'] ?? '')}
          onChange={(event) => {
            editor.commands.updateAttributes('image', { alt: event.target.value });
          }}
        />
      ) : null}
      <EditorContent editor={editor} />
      {linking ? (
        <LinkDialog
          initial={{ href: linkAttrs.href ?? '', text: '', newTab: linkAttrs.target === '_blank' }}
          canRemove={editor.isActive('link')}
          onApply={applyLink}
          onRemove={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            setLinking(false);
          }}
          onClose={() => {
            setLinking(false);
          }}
        />
      ) : null}
      {picking ? (
        <MediaPickerContainer
          open
          onInsert={insertImage}
          onClose={() => {
            setPicking(false);
          }}
        />
      ) : null}
    </Box>
  );
}
