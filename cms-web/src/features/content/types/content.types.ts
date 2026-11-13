import type { ContentStatus, ContentType } from '../../../shared/api/types';

export type RichTextDoc = Readonly<Record<string, unknown>>;

export interface EditorValues {
  title: string;
  slug: string;
  body: RichTextDoc;
  seo_title: string;
  seo_description: string;
  featured_image_id: string;
  social_image_id: string;
  tags: string[];
  category: string;
  parent_id: string;
}

export type DisplayStatus = ContentStatus | 'scheduled';

export function listPath(type: ContentType): string {
  return type === 'article' ? '/content/articles' : '/content/pages';
}

export function editorPath(type: ContentType, id: string): string {
  return `${listPath(type)}/${id}`;
}

export function displayStatus(status: ContentStatus, scheduledAt: string | null): DisplayStatus {
  return scheduledAt !== null && status !== 'published' ? 'scheduled' : status;
}
