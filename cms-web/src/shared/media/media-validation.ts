import { format } from '../i18n/format';
import { formatBytes } from '../utils/bytes';
import { mediaMessages as m } from './media.messages';

const MB = 1024 * 1024;
// FR-MEDIA-01 and 02, and the SVG limit in ADR-0013. The server decides, and this saves a wait.
const MAX_BYTES = 20 * MB;
const MAX_SVG_BYTES = 5 * MB;
const SVG = 'image/svg+xml';
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  SVG,
  'application/pdf',
]);

export function validateFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!ALLOWED.has(file.type)) return format(m.unsupportedType, { name: file.name });
  const limit = file.type === SVG ? MAX_SVG_BYTES : MAX_BYTES;
  return file.size > limit
    ? format(m.tooLarge, { name: file.name, limit: formatBytes(limit) })
    : null;
}

export function isImageMedia(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
