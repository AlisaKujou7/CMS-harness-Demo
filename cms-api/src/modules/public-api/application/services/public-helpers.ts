import type { PublicMedia } from '../ports/in/public-api.ports.js';
import type {
  PublicBodyNode,
  PublicMediaRecord,
  PublishedSummaryRecord,
} from '../ports/out/public-sources.port.js';
import type { PublicApiDeps } from '../public-api-deps.js';
import type { PublicContentSummary } from '../ports/in/public-api.ports.js';

export async function cached<T>(
  deps: Pick<PublicApiDeps, 'responseCache' | 'publicApiConfig'>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const entry = await deps.responseCache.lookup(key);
  if (entry.value !== null) return JSON.parse(entry.value) as T;
  const value = await load();
  await entry.store(JSON.stringify(value), deps.publicApiConfig.cacheTtlSeconds);
  return value;
}

export function toPublicMedia(record: PublicMediaRecord): PublicMedia {
  return {
    id: record.id,
    filename: record.filename,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    width: record.width,
    height: record.height,
    altText: record.altText,
    caption: record.caption,
    url: record.url,
    variants: record.variants,
  };
}

export function toSummary(
  record: PublishedSummaryRecord,
  featuredImage: PublicMedia | null,
): PublicContentSummary {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    authorName: record.authorName,
    tags: record.tags,
    category: record.category,
    parent: record.parent,
    featuredImage,
    publishedAt: record.publishedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// Includes what is shown from outside the item's own version: renaming an author or a parent page
// changes a response without changing the item.
export function contentTag(record: PublishedSummaryRecord): string {
  return [record.id, record.version, record.authorName, record.parent?.slug, record.parent?.title]
    .map(String)
    .join(':');
}

export function inlineMediaIds(node: PublicBodyNode): string[] {
  const mediaId = node.attrs?.['mediaId'];
  return [
    ...(node.type === 'image' && typeof mediaId === 'string' ? [mediaId] : []),
    ...(node.content ?? []).flatMap(inlineMediaIds),
  ];
}

function resolveImage(
  node: PublicBodyNode,
  media: ReadonlyMap<string, PublicMediaRecord>,
): PublicBodyNode | null {
  const mediaId = node.attrs?.['mediaId'];
  if (typeof mediaId !== 'string') return node;
  const record = media.get(mediaId);
  if (!record) return null;
  return {
    ...node,
    attrs: {
      alt: record.altText,
      ...node.attrs,
      src: record.url,
      width: record.width,
      height: record.height,
    },
  };
}

// A stored src would have expired by now, so each read gets a current one. An image whose file was
// force-deleted goes, because a broken image helps nobody.
export function resolveBody(
  node: PublicBodyNode,
  media: ReadonlyMap<string, PublicMediaRecord>,
): PublicBodyNode {
  if (!node.content) return node;
  const content = node.content.flatMap((child) => {
    const resolved =
      child.type === 'image' ? resolveImage(child, media) : resolveBody(child, media);
    return resolved ? [resolved] : [];
  });
  return { ...node, content };
}

// What about the media can change a response. Signed URLs are left out because they differ every
// time, which is why the time slot is in: a response is never revalidated past its URLs' lifetime.
export function mediaTag(
  deps: Pick<PublicApiDeps, 'clock' | 'publicApiConfig'>,
  records: readonly PublicMediaRecord[],
): string {
  if (records.length === 0) return '';
  const slotMs = deps.publicApiConfig.urlRefreshSeconds * 1000;
  const slot = Math.floor(deps.clock.now().getTime() / slotMs);
  const parts = records
    .map((r) =>
      [r.id, r.variantStatus, r.width, r.height, r.altText, r.caption].map(String).join(':'),
    )
    .sort();
  return `${String(slot)}|${parts.join(',')}`;
}
