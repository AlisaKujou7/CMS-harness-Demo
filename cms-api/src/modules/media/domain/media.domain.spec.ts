import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { aMediaItem } from '../../../../test/builders/a-media-item.js';
import { MediaItem } from './entities/media-item.entity.js';
import {
  FileTooLargeError,
  InvalidMediaError,
  MediaAlreadyExistsError,
  MediaInUseError,
  MediaNotFoundError,
  UnsupportedMediaTypeError,
  UploadChangedError,
  UploadNotFoundError,
} from './errors/media.errors.js';
import {
  assertAllowedType,
  detectMimeType,
  extensionOf,
  isImage,
  normalizeFilename,
  originalKey,
  parseUploadKey,
  SVG_MIME,
  toUploadKey,
  variantKey,
} from './services/media-types.js';

const ID = '55555555-5555-4555-8555-555555555555';
const text = (value: string) => Buffer.from(value, 'latin1');

describe('media types (FR-MEDIA-01, FR-MEDIA-03)', () => {
  describe('assertAllowedType', () => {
    it.each([
      ['image/png', 'png'],
      ['image/jpeg', 'jpg'],
      ['image/jpeg', 'jpeg'],
      ['image/webp', 'webp'],
      ['image/gif', 'gif'],
      ['image/svg+xml', 'svg'],
      ['application/pdf', 'pdf'],
    ])('allows %s as .%s', (mime, extension) => {
      expect(() => {
        assertAllowedType(mime, extension);
      }).not.toThrow();
    });

    it.each([
      ['image/png', 'jpg'],
      ['application/pdf', 'png'],
      ['text/html', 'html'],
      ['application/x-msdownload', 'exe'],
      ['constructor', 'png'],
      ['__proto__', 'png'],
      ['image/png', ''],
    ])('refuses %s as .%s', (mime, extension) => {
      expect(() => {
        assertAllowedType(mime, extension);
      }).toThrow(UnsupportedMediaTypeError);
    });
  });

  describe('detectMimeType', () => {
    it.each([
      ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])],
      ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xdb])],
      ['image/gif', text('GIF87a...')],
      ['image/gif', text('GIF89a...')],
      ['image/webp', text('RIFF\0\0\0\0WEBPVP8 ')],
      ['application/pdf', text('%PDF-1.4')],
      [SVG_MIME, text('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
      [SVG_MIME, text('<svg>')],
      [SVG_MIME, text('\u00ef\u00bb\u00bf  <svg>')],
      [SVG_MIME, text('<?xml version="1.0"?>\n<svg>')],
      [SVG_MIME, text('<?xml version="1.0"?><!-- made by x --><!DOCTYPE svg><!-- y --><svg >')],
      [SVG_MIME, text('<SVG>')],
    ])('recognizes %s', (mime, bytes) => {
      expect(detectMimeType(bytes)).toBe(mime);
    });

    it.each([
      ['nothing', text('')],
      ['HTML', text('<html><script>alert(1)</script></html>')],
      ['a Windows program', text('MZ\x90\0')],
      ['part of a PNG signature', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
      ['RIFF that is not WebP', text('RIFF\0\0\0\0WAVEfmt ')],
      ['an element merely starting with svg', text('<svgx>')],
      ['svg after other markup', text('<div><svg>')],
    ])('does not recognize %s', (_name, bytes) => {
      expect(detectMimeType(bytes)).toBeNull();
    });

    it('never throws, whatever the bytes', () => {
      fc.assert(
        fc.property(fc.uint8Array({ maxLength: 5000 }), (bytes) => {
          expect(() => detectMimeType(bytes)).not.toThrow();
        }),
      );
    });

    it('looks only at the start of a long file', () => {
      const late = Buffer.concat([Buffer.alloc(5000, 0x20), text('<svg>')]);

      expect(detectMimeType(late)).toBeNull();
    });
  });

  it('reads the last extension, in lowercase', () => {
    expect(extensionOf('a.tar.PNG')).toBe('png');
    expect(extensionOf('evil.php.jpg')).toBe('jpg');
    expect(extensionOf('noextension')).toBe('');
  });

  it('knows images from documents', () => {
    expect(isImage('image/png')).toBe(true);
    expect(isImage(SVG_MIME)).toBe(true);
    expect(isImage('application/pdf')).toBe(false);
  });

  describe('normalizeFilename', () => {
    it('keeps only the last path segment', () => {
      expect(normalizeFilename('C:\\Users\\me\\hero.png')).toBe('hero.png');
      expect(normalizeFilename('../../etc/hero.png')).toBe('hero.png');
      expect(normalizeFilename('  hero.png ')).toBe('hero.png');
    });

    it('removes markup and characters that could not be stored', () => {
      expect(normalizeFilename('<img src=x onerror=alert(1)>he\0ro.png')).toBe('hero.png');
    });

    it('accepts the longest allowed name', () => {
      expect(normalizeFilename(`${'a'.repeat(251)}.png`)).toHaveLength(255);
    });

    it.each(['', '   ', 'dir/', '.htaccess', `${'a'.repeat(252)}.png`])('refuses "%s"', (name) => {
      expect(() => normalizeFilename(name)).toThrow(InvalidMediaError);
    });
  });

  describe('upload keys', () => {
    it('round trips', () => {
      const upload = { ownerId: 'actor-1', uploadId: ID, extension: 'png' };

      expect(toUploadKey(upload)).toBe(`uploads/actor-1/${ID}.png`);
      expect(parseUploadKey(toUploadKey(upload))).toEqual(upload);
    });

    it.each([
      `media/${ID}/original.png`,
      `uploads/a/b/${ID}.png`,
      `uploads/../${ID}.png`,
      `uploads/a/not-a-uuid.png`,
      `uploads/a/${ID}`,
      `uploads/a/${ID}.PNG`,
      `x/uploads/a/${ID}.png`,
      `uploads/a/${ID}.png/`,
      '',
    ])('refuses %s', (key) => {
      expect(() => parseUploadKey(key)).toThrow(InvalidMediaError);
    });
  });

  it('keeps final keys out of the upload area', () => {
    expect(originalKey(ID, 'png')).toBe(`media/${ID}/original.png`);
    expect(variantKey(ID, 'thumbnail')).toBe(`media/${ID}/thumbnail.webp`);
  });
});

describe('MediaItem', () => {
  const create = (overrides: { mimeType?: string; altText?: string | null } = {}) =>
    MediaItem.create({
      id: ID,
      storageKey: 'k',
      filename: 'f.png',
      mimeType: overrides.mimeType ?? 'image/png',
      sizeBytes: 5,
      uploadedBy: 'u',
      createdAt: new Date(0),
      metadata: { altText: overrides.altText ?? null, caption: null },
    });

  it('starts an image waiting for variants, with no dimensions yet', () => {
    expect(create()).toMatchObject({
      variantStatus: 'pending',
      width: null,
      height: null,
      variants: {},
    });
  });

  it('expects no variants for a document', () => {
    expect(create({ mimeType: 'application/pdf' }).variantStatus).toBe('none');
  });

  it('strips markup and trims metadata, and treats blank as nothing', () => {
    expect(create({ altText: '  <b>A hero</b> ' }).altText).toBe('A hero');
    expect(create({ altText: '   ' }).altText).toBeNull();
  });

  it('limits alt text and caption', () => {
    const item = aMediaItem();

    expect(item.withMetadata({ altText: 'a'.repeat(500) }).altText).toHaveLength(500);
    expect(() => item.withMetadata({ altText: 'a'.repeat(501) })).toThrow(
      expect.objectContaining({ details: { field: 'alt_text' } }),
    );
    expect(item.withMetadata({ caption: 'a'.repeat(2000) }).caption).toHaveLength(2000);
    expect(() => item.withMetadata({ caption: 'a'.repeat(2001) })).toThrow(
      expect.objectContaining({ details: { field: 'caption' } }),
    );
  });

  it('changes only what it is given, and leaves the original alone', () => {
    const item = aMediaItem({ altText: 'Alt', caption: 'Cap' });

    const changed = item.withMetadata({ caption: null });

    expect(changed).toMatchObject({ altText: 'Alt', caption: null });
    expect(item.caption).toBe('Cap');
  });

  it('lists every object it owns', () => {
    const item = aMediaItem({
      storageKey: 'orig',
      variants: { thumbnail: { key: 'thumb', width: 1, height: 1 } },
    });

    expect(item.storedKeys()).toEqual(['orig', 'thumb']);
  });
});

describe('media errors', () => {
  it.each([
    [new MediaNotFoundError(), 'not_found', 'NOT_FOUND'],
    [new InvalidMediaError('f', 'm'), 'validation', 'VALIDATION_ERROR'],
    [new UnsupportedMediaTypeError('r'), 'validation', 'UNSUPPORTED_MEDIA_TYPE'],
    [new FileTooLargeError(5), 'validation', 'FILE_TOO_LARGE'],
    [new UploadNotFoundError(), 'not_found', 'UPLOAD_NOT_FOUND'],
    [new UploadChangedError(), 'conflict', 'UPLOAD_CHANGED'],
    [new MediaAlreadyExistsError(), 'conflict', 'MEDIA_EXISTS'],
    [new MediaInUseError(2), 'conflict', 'MEDIA_IN_USE'],
  ])('%s', (error, kind, code) => {
    expect(error).toMatchObject({ kind, code });
  });

  it('says what the limit and the usage were', () => {
    expect(new FileTooLargeError(5).details).toEqual({ max_bytes: 5 });
    expect(new MediaInUseError(2).details).toEqual({ usage_count: 2 });
  });
});
