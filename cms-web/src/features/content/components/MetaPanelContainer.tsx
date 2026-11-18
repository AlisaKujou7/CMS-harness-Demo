import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import type { ContentType } from '../../../shared/api/types';
import { listCategories, listContent } from '../api/content.api';
import { contentMessages as m } from '../content.messages';
import { ImageController } from './ImageFieldContainer';
import { PanelCard } from './PanelCard';
import type { PanelProps } from './SeoPanel';
import { TagsField } from './TagsField';

interface SelectFieldProps extends PanelProps {
  readonly name: 'category' | 'parent_id';
  readonly label: string;
  readonly noneLabel: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

function SelectField(props: SelectFieldProps) {
  const { form, disabled, onFieldBlur, name, label, noneLabel, options } = props;
  const error = form.formState.errors[name];
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <TextField
          {...field}
          select
          size="small"
          label={label}
          disabled={disabled}
          error={error !== undefined}
          helperText={error?.message}
          onBlur={() => {
            field.onBlur();
            onFieldBlur();
          }}
        >
          <MenuItem value="">{noneLabel}</MenuItem>
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}

function ArticleFields(props: PanelProps) {
  const { form, disabled } = props;
  const categories = useQuery({ queryKey: ['content', 'categories'], queryFn: listCategories });
  return (
    <>
      <Controller
        control={form.control}
        name="tags"
        render={({ field }) => (
          <TagsField value={field.value} disabled={disabled} onChange={field.onChange} />
        )}
      />
      <SelectField
        {...props}
        name="category"
        label={m.editor.category}
        noneLabel={m.editor.noCategory}
        options={(categories.data ?? []).map((value) => ({ value, label: value }))}
      />
    </>
  );
}

function PageFields({ ownId, ...props }: PanelProps & { readonly ownId: string | null }) {
  const parents = useQuery({
    queryKey: ['content', 'parents'],
    queryFn: () => listContent({ type: 'page', page_size: 100, sort: 'title' }),
  });
  const options = (parents.data?.data ?? [])
    .filter((page) => page.id !== ownId)
    .map((page) => ({ value: page.id, label: page.title }));
  return (
    <SelectField
      {...props}
      name="parent_id"
      label={m.editor.parent}
      noneLabel={m.editor.noParent}
      options={options}
    />
  );
}

export interface MetaPanelProps extends PanelProps {
  readonly type: ContentType;
  readonly ownId: string | null;
}

// Tags and a category belong to articles, and only pages nest (01-Requirements 6.2).
export function MetaPanelContainer({ type, ownId, ...shared }: MetaPanelProps) {
  return (
    <PanelCard title={m.editor.details}>
      <ImageController
        form={shared.form}
        disabled={shared.disabled}
        name="featured_image_id"
        label={m.editor.featuredImage}
      />
      {type === 'article' ? (
        <ArticleFields {...shared} />
      ) : (
        <PageFields {...shared} ownId={ownId} />
      )}
    </PanelCard>
  );
}
