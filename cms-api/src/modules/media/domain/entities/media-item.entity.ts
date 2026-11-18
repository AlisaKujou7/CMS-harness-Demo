import { safeText } from '../../../../shared/kernel/text-safety.js';
import { InvalidMediaError } from '../errors/media.errors.js';
import { isImage } from '../services/media-types.js';

const MAX_ALT_LENGTH = 500;
const MAX_CAPTION_LENGTH = 2000;

export type VariantStatus = 'pending' | 'ready' | 'failed' | 'none';

export interface MediaVariant {
  readonly key: string;
  readonly width: number;
  readonly height: number;
}

export type MediaVariants = Readonly<Record<string, MediaVariant>>;

export interface MediaMetadata {
  readonly altText: string | null;
  readonly caption: string | null;
}

export interface MediaItemProps extends MediaMetadata {
  readonly id: string;
  readonly storageKey: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly variants: MediaVariants;
  readonly variantStatus: VariantStatus;
  readonly uploadedBy: string;
  readonly createdAt: Date;
}

function optionalText(field: string, input: string | null, max: number): string | null {
  const value = safeText(input ?? '').trim();
  if (value.length > max) {
    throw new InvalidMediaError(field, `Must be at most ${String(max)} characters`);
  }
  return value === '' ? null : value;
}

export function validMediaMetadata(metadata: MediaMetadata): MediaMetadata {
  return {
    altText: optionalText('alt_text', metadata.altText, MAX_ALT_LENGTH),
    caption: optionalText('caption', metadata.caption, MAX_CAPTION_LENGTH),
  };
}

export class MediaItem implements MediaItemProps {
  readonly id: string;
  readonly storageKey: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly variants: MediaVariants;
  readonly variantStatus: VariantStatus;
  readonly uploadedBy: string;
  readonly createdAt: Date;

  private constructor(props: MediaItemProps) {
    this.id = props.id;
    this.storageKey = props.storageKey;
    this.filename = props.filename;
    this.mimeType = props.mimeType;
    this.sizeBytes = props.sizeBytes;
    this.width = props.width;
    this.height = props.height;
    this.altText = props.altText;
    this.caption = props.caption;
    this.variants = props.variants;
    this.variantStatus = props.variantStatus;
    this.uploadedBy = props.uploadedBy;
    this.createdAt = props.createdAt;
  }

  static create(input: {
    id: string;
    storageKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
    createdAt: Date;
    metadata: MediaMetadata;
  }): MediaItem {
    const { metadata, ...fields } = input;
    return new MediaItem({
      ...fields,
      ...validMediaMetadata(metadata),
      width: null,
      height: null,
      variants: {},
      variantStatus: isImage(input.mimeType) ? 'pending' : 'none',
    });
  }

  static restore(props: MediaItemProps): MediaItem {
    return new MediaItem(props);
  }

  withMetadata(changes: Partial<MediaMetadata>): MediaItem {
    return new MediaItem({
      ...this,
      ...validMediaMetadata({ altText: this.altText, caption: this.caption, ...changes }),
    });
  }

  // Every object this item owns in storage, for when it is deleted.
  storedKeys(): readonly string[] {
    return [this.storageKey, ...Object.values(this.variants).map((variant) => variant.key)];
  }
}
