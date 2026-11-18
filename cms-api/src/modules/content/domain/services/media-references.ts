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

function withoutImages(node: RichTextNode, ids: ReadonlySet<string>): RichTextNode {
  if (!node.content) return node;
  const kept = node.content.filter(
    (child) => !(child.type === 'image' && ids.has(String(child.attrs?.['mediaId']))),
  );
  return { ...node, content: kept.map((child) => withoutImages(child, ids)) };
}

// For content restored from a time when this media still existed (FR-CONTENT-09).
export function withoutMedia<T extends MediaReferencing>(content: T, ids: readonly string[]): T {
  const gone = new Set(ids);
  const keep = (id: string | null | undefined) => (id != null && gone.has(id) ? null : id);
  return {
    ...content,
    ...(content.featuredImageId === undefined
      ? {}
      : { featuredImageId: keep(content.featuredImageId) }),
    ...(content.socialImageId === undefined ? {} : { socialImageId: keep(content.socialImageId) }),
    ...(content.body ? { body: withoutImages(content.body, gone) } : {}),
  };
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
