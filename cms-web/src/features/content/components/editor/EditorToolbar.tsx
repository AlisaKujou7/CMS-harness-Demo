import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import type { Editor } from '@tiptap/react';
import type { ReactNode } from 'react';
import { FullscreenIcon, ImageIcon, LinkIcon } from '../../../../design-system/icons';
import { contentMessages as m } from '../../content.messages';
import { TOOLBAR_GROUPS } from './toolbar-items';

interface ToolButtonProps {
  readonly label: string;
  readonly icon: ReactNode;
  readonly active: boolean;
  readonly disabled: boolean;
  onClick(): void;
}

function ToolButton({ label, icon, active, disabled, onClick }: ToolButtonProps) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          sx={{
            width: 40,
            height: 40,
            typography: 'labelLarge',
            color: 'md.onSurfaceVariant',
            bgcolor: active ? 'md.secondaryContainer' : 'transparent',
            borderRadius: 1,
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

export interface EditorToolbarProps {
  readonly editor: Editor;
  readonly fullscreen: boolean;
  readonly disabled: boolean;
  onLink(): void;
  onImage(): void;
  onFullscreen(): void;
}

// 03-DESIGN 19.2: sticky at the top of the editor pane, with groups split by dividers.
export function EditorToolbar(props: EditorToolbarProps) {
  const { editor, fullscreen, disabled, onLink, onImage, onFullscreen } = props;
  return (
    <Box
      role="toolbar"
      aria-label={m.toolbar.label}
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0.5,
        p: 0.5,
        bgcolor: 'md.surfaceContainerLow',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {TOOLBAR_GROUPS.map((group) => (
        <Box key={group[0]?.label} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {group.map((item) => (
            <ToolButton
              key={item.label}
              label={item.label}
              icon={item.icon}
              active={item.active?.(editor) ?? false}
              disabled={disabled || (item.disabled?.(editor) ?? false)}
              onClick={() => {
                item.run(editor);
              }}
            />
          ))}
          <Divider orientation="vertical" flexItem />
        </Box>
      ))}
      <ToolButton
        label={m.toolbar.link}
        icon={<LinkIcon />}
        active={editor.isActive('link')}
        disabled={disabled}
        onClick={onLink}
      />
      <ToolButton
        label={m.toolbar.image}
        icon={<ImageIcon />}
        active={false}
        disabled={disabled}
        onClick={onImage}
      />
      <ToolButton
        label={m.toolbar.fullscreen}
        icon={<FullscreenIcon />}
        active={fullscreen}
        disabled={false}
        onClick={onFullscreen}
      />
    </Box>
  );
}
