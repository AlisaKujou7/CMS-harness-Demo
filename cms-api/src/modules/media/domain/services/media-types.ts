import { safeText } from '../../../../shared/kernel/text-safety.js';
import { InvalidMediaError, UnsupportedMediaTypeError } from '../errors/media.errors.js';

export const SVG_MIME = 'image/svg+xml';
// Enough to hold every signature below, and an SVG's XML declaration and comments before its root.
export const SIGNATURE_BYTES = 4096;

// FR-MEDIA-01.
const EXTENSIONS_BY_MIME: Readonly<Record<string, readonly string[]>> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  [SVG_MIME]: ['svg'],
  'application/pdf': ['pdf'],
};

const SVG_START =
  /^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!doctype[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i;

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

export function assertAllowedType(mimeType: string, extension: string): void {
  const extensions = Object.hasOwn(EXTENSIONS_BY_MIME, mimeType)
    ? EXTENSIONS_BY_MIME[mimeType]
    : undefined;
  if (!extensions) throw new UnsupportedMediaTypeError(`${mimeType} is not an allowed type`);
  if (!extensions.includes(extension)) {
    throw new UnsupportedMediaTypeError(`the extension does not match ${mimeType}`);
  }
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(text: string): number[] {
  return [...text].map((character) => character.charCodeAt(0));
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.subarray(0, SIGNATURE_BYTES));
  return SVG_START.test(head.replace(/^ï»¿/, '').trimStart());
}

// Reads what the file really is, whatever it claims to be.
export function detectMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'image/gif';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf';
  return looksLikeSvg(bytes) ? SVG_MIME : null;
}

const MAX_FILENAME_LENGTH = 255;

// A browser may send a full path, and the name is shown back and used in download headers.
export function normalizeFilename(input: string): string {
  const filename = safeText(input)
    .replace(/^.*[/\\]/s, '')
    .trim();
  if (filename === '' || filename.startsWith('.') || filename.length > MAX_FILENAME_LENGTH) {
    throw new InvalidMediaError('filename', 'Filename must be between 1 and 255 characters');
  }
  return filename;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UPLOAD_KEY = new RegExp(`^uploads/([\\w-]+)/(${UUID})\\.([a-z0-9]+)$`);

export interface UploadKey {
  readonly ownerId: string;
  readonly uploadId: string;
  readonly extension: string;
}

export function toUploadKey(upload: UploadKey): string {
  return `uploads/${upload.ownerId}/${upload.uploadId}.${upload.extension}`;
}

export function parseUploadKey(key: string): UploadKey {
  const match = UPLOAD_KEY.exec(key);
  if (!match) throw new InvalidMediaError('storage_key', 'This is not an upload key');
  const [, ownerId, uploadId, extension] = match as unknown as [string, string, string, string];
  return { ownerId, uploadId, extension };
}

// The final keys are never handed out for writing, so a presigned URL cannot replace a checked file.
export function originalKey(mediaId: string, extension: string): string {
  return `media/${mediaId}/original.${extension}`;
}

export function variantKey(mediaId: string, variant: string): string {
  return `media/${mediaId}/${variant}.webp`;
}
