import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { CloseIcon } from '../../../design-system/icons';
import { format } from '../../../shared/i18n/format';
import { contentMessages as m } from '../content.messages';

export interface TagsFieldProps {
  readonly value: readonly string[];
  readonly disabled: boolean;
  onChange(tags: string[]): void;
}

// The server stores tags in lowercase, so they are added that way too.
export function addTag(tags: readonly string[], text: string): string[] {
  const tag = text.trim().toLowerCase();
  return tag === '' || tags.includes(tag) ? [...tags] : [...tags, tag];
}

// 03-DESIGN 10.6
export function TagsField({ value, disabled, onChange }: TagsFieldProps) {
  const [text, setText] = useState('');
  return (
    <Box>
      <Typography variant="titleSmall" component="p" sx={{ mb: 1 }}>
        {m.editor.tags}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
        {value.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            disabled={disabled}
            deleteIcon={<CloseIcon titleAccess={format(m.editor.removeTag, { tag })} />}
            onDelete={() => {
              onChange(value.filter((other) => other !== tag));
            }}
          />
        ))}
      </Box>
      <TextField
        size="small"
        label={m.editor.addTag}
        helperText={m.editor.tagHelp}
        disabled={disabled}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          onChange(addTag(value, text));
          setText('');
        }}
      />
    </Box>
  );
}
