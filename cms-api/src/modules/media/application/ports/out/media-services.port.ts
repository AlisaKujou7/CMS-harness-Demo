export interface StoredObject {
  readonly size: number;
  readonly etag: string;
  readonly contentType: string;
}

export interface UploadUrlRequest {
  readonly key: string;
  readonly contentType: string;
  readonly contentLength: number;
  readonly expiresInSeconds: number;
}

export interface ReadUrlRequest {
  readonly key: string;
  readonly filename: string;
  readonly attachment: boolean;
  readonly expiresInSeconds: number;
}

export interface ReadRequest {
  // Returns null if the object has changed from this version.
  readonly etag?: string;
  readonly maxBytes: number;
}

export interface ObjectStorage {
  uploadUrl(request: UploadUrlRequest): Promise<string>;
  readUrl(request: ReadUrlRequest): Promise<string>;
  head(key: string): Promise<StoredObject | null>;
  read(key: string, request: ReadRequest): Promise<Uint8Array | null>;
  // Returns false if the source has changed from this version.
  copyIfUnchanged(from: string, to: string, etag: string): Promise<boolean>;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  delete(keys: readonly string[]): Promise<void>;
  // Returns how many were removed.
  deleteOlderThan(prefix: string, cutoff: Date): Promise<number>;
}

export interface ProcessedVariant {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export interface ProcessedImage {
  readonly width: number;
  readonly height: number;
  readonly variants: readonly ProcessedVariant[];
}

export interface ImageProcessor {
  // Returns null for a file that cannot be read as an image, which no retry would change.
  process(bytes: Uint8Array): Promise<ProcessedImage | null>;
}

export interface SvgSanitizer {
  // SEC-05. Returns null for a file that is not well-formed SVG.
  sanitize(bytes: Uint8Array): Uint8Array | null;
}

export interface MediaVariantQueue {
  enqueue(mediaId: string): Promise<void>;
}

// The content module's answer, reached through the composition root.
export interface MediaUsageReader {
  countUsage(mediaId: string): Promise<number>;
}
