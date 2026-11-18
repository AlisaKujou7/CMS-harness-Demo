import { describe, expect, it } from 'vitest';
import { isImageMedia, validateFile } from './media-validation';

const MB = 1024 * 1024;
const file = (type: string, size = 1, name = 'f') => ({ name, type, size });

describe('validateFile (FR-MEDIA-01, 02)', () => {
  it.each([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf',
  ])('accepts %s', (type) => {
    expect(validateFile(file(type))).toBeNull();
  });

  it('names the file when refusing its type', () => {
    expect(validateFile(file('text/html', 1, 'page.html'))).toContain('page.html');
  });

  it('allows 20 MB, and no more', () => {
    expect(validateFile(file('image/png', 20 * MB))).toBeNull();
    expect(validateFile(file('image/png', 20 * MB + 1))).toContain('20.0 MB');
  });

  it('allows 5 MB of SVG, and no more', () => {
    expect(validateFile(file('image/svg+xml', 5 * MB))).toBeNull();
    expect(validateFile(file('image/svg+xml', 5 * MB + 1))).toContain('5.0 MB');
  });
});

describe('isImageMedia', () => {
  it('tells an image from a document', () => {
    expect(isImageMedia('image/png')).toBe(true);
    expect(isImageMedia('application/pdf')).toBe(false);
  });
});
