import {
  MediaItem,
  type MediaItemProps,
} from '../../src/modules/media/domain/entities/media-item.entity.js';

export const MEDIA_ID = '55555555-5555-4555-8555-555555555555';

// The smallest bytes each detector accepts, padded so ranges and sizes behave like real files.
export const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
export const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
export const PDF_BYTES = Buffer.from('%PDF-1.7\n%stuff');

export function aMediaItem(overrides: Partial<MediaItemProps> = {}): MediaItem {
  return MediaItem.restore({
    id: MEDIA_ID,
    storageKey: `media/${MEDIA_ID}/original.png`,
    filename: 'hero.png',
    mimeType: 'image/png',
    sizeBytes: 1000,
    width: null,
    height: null,
    altText: null,
    caption: null,
    variants: {},
    variantStatus: 'pending',
    uploadedBy: 'author-1',
    createdAt: new Date('2026-05-01T00:00:00Z'),
    ...overrides,
  });
}
