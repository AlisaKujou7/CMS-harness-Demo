import type { RichTextNode } from './rich-text.js';

export interface MediaReferencing {
  readonly featuredImageId?: string | null;
  readonly socialImageId?: string | null;
  readonly body?: RichTextNode;
}

function inlineMediaIds(node: RichTextNode): string[] {
  const mediaId = node.attrs?.['mediaId'];
  return [
    ...(node.type === 'image' && typeof mediaId === 'string' ? [mediaId] : []),
    ...(node.content ?? []).flatMap(inlineMediaIds),
  ];
}

// Everything this content needs to keep existing in the media library (FR-MEDIA-07).
export function referencedMediaIds(content: MediaReferencing): readonly string[] {
  return [
    ...new Set([
      ...(content.featuredImageId == null ? [] : [content.featuredImageId]),
      ...(content.socialImageId == null ? [] : [content.socialImageId]),
      ...(content.body ? inlineMediaIds(content.body) : []),
    ]),
  ];
}
