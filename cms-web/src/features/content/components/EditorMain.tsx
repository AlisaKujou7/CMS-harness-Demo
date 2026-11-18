import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useMemo } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { interval, map, startWith } from 'rxjs';
import { useObservableState } from '../../../shared/hooks/useObservableState';
import { contentMessages as m } from '../content.messages';
import type { EditorValues, RichTextDoc } from '../types/content.types';
import { AutosaveIndicator, type IndicatorState } from './AutosaveIndicator';
import { LazyRichTextEditor } from './editor/LazyRichTextEditor';

export interface EditorMainProps {
  readonly form: UseFormReturn<EditorValues>;
  readonly editable: boolean;
  readonly indicator: IndicatorState;
  readonly initialBody: RichTextDoc;
  onFieldBlur(): void;
}

const TICK_MS = 1000;

// A clock for "Saved 5 seconds ago", subscribed through the hook that cleans up after itself.
function useNow(): Date {
  const now$ = useMemo(
    () =>
      interval(TICK_MS).pipe(
        startWith(0),
        map(() => new Date()),
      ),
    [],
  );
  return useObservableState(now$, new Date());
}

// 03-DESIGN 5.3 and 12.4
export function EditorMain({
  form,
  editable,
  indicator,
  initialBody,
  onFieldBlur,
}: EditorMainProps) {
  const now = useNow();
  const { errors } = form.formState;
  const blurring = (onBlur: () => void) => () => {
    onBlur();
    onFieldBlur();
  };
  const title = form.register('title');
  const slug = form.register('slug');
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <TextField
        {...title}
        onBlur={(event) => {
          void title.onBlur(event);
          onFieldBlur();
        }}
        disabled={!editable}
        variant="standard"
        label={m.editor.title}
        error={errors.title !== undefined}
        helperText={errors.title?.message}
        slotProps={{ input: { sx: { typography: 'headlineLarge' }, disableUnderline: true } }}
      />
      <AutosaveIndicator state={indicator} now={now} />
      <TextField
        {...slug}
        onBlur={(event) => {
          void slug.onBlur(event);
          onFieldBlur();
        }}
        disabled={!editable}
        variant="filled"
        size="small"
        label={m.editor.slug}
        error={errors.slug !== undefined}
        helperText={errors.slug?.message ?? m.editor.slugHelp}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <Controller
        control={form.control}
        name="body"
        render={({ field }) => (
          <LazyRichTextEditor
            initial={initialBody}
            editable={editable}
            onChange={field.onChange}
            onBlur={blurring(field.onBlur)}
          />
        )}
      />
    </Box>
  );
}
