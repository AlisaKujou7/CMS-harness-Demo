import type { MediaItem } from '../../domain/entities/media-item.entity.js';
import { MediaNotFoundError } from '../../domain/errors/media.errors.js';
import { isImage } from '../../domain/services/media-types.js';
import type { MediaDeps } from '../media-deps.js';
import type { MediaVariantView, MediaView } from '../ports/in/media.ports.js';
import type { MediaRepository } from '../ports/out/media-repository.port.js';

export async function loadMedia(media: MediaRepository, id: string): Promise<MediaItem> {
  const item = await media.findById(id);
  if (!item) throw new MediaNotFoundError();
  return item;
}

// SEC-06: storage is private, so every URL is signed and short-lived. Images open in the browser,
// which is safe because an SVG was sanitized on the way in. Anything else downloads.
export async function toMediaView(
  deps: Pick<MediaDeps, 'storage' | 'mediaConfig'>,
  item: MediaItem,
  uploaderName: string | null = null,
): Promise<MediaView> {
  const expiresInSeconds = deps.mediaConfig.readUrlTtlSeconds;
  const urlOf = (key: string) =>
    deps.storage.readUrl({
      key,
      filename: item.filename,
      attachment: !isImage(item.mimeType),
      expiresInSeconds,
    });
  const variants = await Promise.all(
    Object.entries(item.variants).map(
      async ([name, variant]): Promise<[string, MediaVariantView]> => [
        name,
        { url: await urlOf(variant.key), width: variant.width, height: variant.height },
      ],
    ),
  );
  return {
    id: item.id,
    filename: item.filename,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    width: item.width,
    height: item.height,
    altText: item.altText,
    caption: item.caption,
    url: await urlOf(item.storageKey),
    variants: Object.fromEntries(variants),
    variantStatus: item.variantStatus,
    uploadedBy: item.uploadedBy,
    uploaderName,
    createdAt: item.createdAt,
  };
}
