import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { ImageIcon } from '../../../design-system/icons';
import { getMedia } from '../../../shared/media/media.api';
import { MediaPickerContainer } from '../../../shared/media/MediaPickerContainer';
import { contentMessages as m } from '../content.messages';
import type { EditorValues } from '../types/content.types';

export interface ImageFieldProps {
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  onChange(id: string): void;
}

function Preview({ id }: { readonly id: string }) {
  const { data, isError } = useQuery({
    queryKey: ['media', 'detail', id],
    queryFn: () => getMedia(id),
    retry: false,
  });
  if (isError) {
    return (
      <Typography variant="bodySmall" color="error" component="p">
        {m.editor.missingImage}
      </Typography>
    );
  }
  if (!data) return null;
  return (
    <img
      src={data.variants['thumbnail']?.url ?? data.url}
      alt={data.alt_text ?? data.filename}
      style={{ maxWidth: '100%', borderRadius: 4, display: 'block' }}
    />
  );
}

// A featured or social image, chosen from the library by id.
export function ImageField({ label, value, disabled, onChange }: ImageFieldProps) {
  const [picking, setPicking] = useState(false);
  return (
    <Box>
      <Typography variant="titleSmall" component="p" sx={{ mb: 1 }}>
        {label}
      </Typography>
      {value === '' ? null : <Preview id={value} />}
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ImageIcon />}
          disabled={disabled}
          aria-label={`${m.editor.selectImage}: ${label}`}
          onClick={() => {
            setPicking(true);
          }}
        >
          {m.editor.selectImage}
        </Button>
        {value === '' ? null : (
          <Button
            size="small"
            disabled={disabled}
            aria-label={`${m.editor.removeImage}: ${label}`}
            onClick={() => {
              onChange('');
            }}
          >
            {m.editor.removeImage}
          </Button>
        )}
      </Box>
      {picking ? (
        <MediaPickerContainer
          open
          onInsert={(item) => {
            onChange(item.id);
            setPicking(false);
          }}
          onClose={() => {
            setPicking(false);
          }}
        />
      ) : null}
    </Box>
  );
}

export interface ImageControllerProps {
  readonly form: UseFormReturn<EditorValues>;
  readonly disabled: boolean;
  readonly name: 'featured_image_id' | 'social_image_id';
  readonly label: string;
}

export function ImageController({ form, disabled, name, label }: ImageControllerProps) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <ImageField
          label={label}
          value={field.value}
          disabled={disabled}
          onChange={field.onChange}
        />
      )}
    />
  );
}
