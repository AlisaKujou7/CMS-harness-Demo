import type { Editor } from '@tiptap/react';
import type { ReactNode } from 'react';
import {
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  CodeIcon,
  ItalicIcon,
  NumberedListIcon,
  ParagraphIcon,
  QuoteIcon,
  RedoIcon,
  RuleIcon,
  StrikeIcon,
  UnderlineIcon,
  UndoIcon,
} from '../../../../design-system/icons';
import { format } from '../../../../shared/i18n/format';
import { contentMessages as m } from '../../content.messages';

export interface ToolbarItem {
  readonly label: string;
  readonly icon: ReactNode;
  run(editor: Editor): void;
  active?(editor: Editor): boolean;
  disabled?(editor: Editor): boolean;
}

const t = m.toolbar;
const chain = (editor: Editor) => editor.chain().focus();

function heading(level: 2 | 3 | 4): ToolbarItem {
  return {
    label: format(t.heading, { level }),
    icon: `H${String(level)}`,
    run: (editor) => chain(editor).toggleHeading({ level }).run(),
    active: (editor) => editor.isActive('heading', { level }),
  };
}

function toggle(
  label: string,
  icon: ReactNode,
  name: string,
  run: (editor: Editor) => void,
): ToolbarItem {
  return { label, icon, run, active: (editor) => editor.isActive(name) };
}

// 03-DESIGN 19.2. Link, Image and Fullscreen need the screen around them, so RichTextEditor adds them.
export const TOOLBAR_GROUPS: readonly (readonly ToolbarItem[])[] = [
  [
    {
      label: t.undo,
      icon: <UndoIcon />,
      run: (editor) => chain(editor).undo().run(),
      disabled: (editor) => !editor.can().undo(),
    },
    {
      label: t.redo,
      icon: <RedoIcon />,
      run: (editor) => chain(editor).redo().run(),
      disabled: (editor) => !editor.can().redo(),
    },
  ],
  [
    toggle(t.paragraph, <ParagraphIcon />, 'paragraph', (editor) =>
      chain(editor).setParagraph().run(),
    ),
    heading(2),
    heading(3),
    heading(4),
  ],
  [
    toggle(t.bold, <BoldIcon />, 'bold', (editor) => chain(editor).toggleBold().run()),
    toggle(t.italic, <ItalicIcon />, 'italic', (editor) => chain(editor).toggleItalic().run()),
    toggle(t.underline, <UnderlineIcon />, 'underline', (editor) =>
      chain(editor).toggleUnderline().run(),
    ),
    toggle(t.strike, <StrikeIcon />, 'strike', (editor) => chain(editor).toggleStrike().run()),
    toggle(t.code, <CodeIcon />, 'code', (editor) => chain(editor).toggleCode().run()),
  ],
  [
    toggle(t.bulletList, <BulletListIcon />, 'bulletList', (editor) =>
      chain(editor).toggleBulletList().run(),
    ),
    toggle(t.orderedList, <NumberedListIcon />, 'orderedList', (editor) =>
      chain(editor).toggleOrderedList().run(),
    ),
  ],
  [
    { label: t.rule, icon: <RuleIcon />, run: (editor) => chain(editor).setHorizontalRule().run() },
    toggle(t.quote, <QuoteIcon />, 'blockquote', (editor) =>
      chain(editor).toggleBlockquote().run(),
    ),
    toggle(t.codeBlock, <CodeBlockIcon />, 'codeBlock', (editor) =>
      chain(editor).toggleCodeBlock().run(),
    ),
  ],
];
