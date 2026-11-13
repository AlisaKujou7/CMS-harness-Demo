import { describe, expect, it } from 'vitest';
import { formatBytes } from './bytes';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1_258_291, '1.2 MB'],
    [1024 ** 2, '1.0 MB'],
    [1024 ** 3, '1.0 GB'],
    [5 * 1024 ** 4, '5120.0 GB'],
  ])('writes %i', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});
