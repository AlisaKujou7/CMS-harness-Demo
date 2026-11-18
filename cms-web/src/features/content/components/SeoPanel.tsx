import { Controller, type UseFormReturn } from 'react-hook-form';
import type { ContentDetail } from '../../../shared/api/types';
import { format } from '../../../shared/i18n/format';
import { contentMessages as m } from '../content.messages';
import { MAX_SEO_DESCRIPTION, MAX_SEO_TITLE } from '../editor-values';
import type { EditorValues } from '../types/content.types';
import { CountedField } from './CountedField';
import { ImageController } from './ImageFieldContainer';
import { PanelCard } from './PanelCard';

export interface PanelProps {
  readonly form: UseFormReturn<EditorValues>;
  readonly disabled: boolean;
  onFieldBlur(): void;
}

interface SeoFieldProps extends PanelProps {
  readonly name: 'seo_title' | 'seo_description';
  readonly label: string;
  readonly limit: number;
  readonly fallback: string | undefined;
}

function SeoField({ form, disabled, onFieldBlur, name, label, limit, fallback }: SeoFieldProps) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <CountedField
          {...field}
          label={label}
          limit={limit}
          disabled={disabled}
          error={form.formState.errors[name]?.message}
          placeholder={fallback ? format(m.editor.seoDefault, { value: fallback }) : undefined}
          multiline={name === 'seo_description'}
          onBlur={() => {
            field.onBlur();
            onFieldBlur();
          }}
        />
      )}
    />
  );
}

export interface SeoPanelProps extends PanelProps {
  readonly content: ContentDetail | null;
}

// FR-SEO-01 and 02: what is left empty falls back to the title and body, which the hint shows.
export function SeoPanel({ form, disabled, onFieldBlur, content }: SeoPanelProps) {
  const shared = { form, disabled, onFieldBlur };
  const seo = content?.effective_seo;
  return (
    <PanelCard title={m.editor.seo}>
      <SeoField
        {...shared}
        name="seo_title"
        label={m.editor.seoTitle}
        limit={MAX_SEO_TITLE}
        fallback={seo?.title}
      />
      <SeoField
        {...shared}
        name="seo_description"
        label={m.editor.seoDescription}
        limit={MAX_SEO_DESCRIPTION}
        fallback={seo?.description}
      />
      <ImageController
        form={form}
        disabled={disabled}
        name="social_image_id"
        label={m.editor.socialImage}
      />
    </PanelCard>
  );
}
