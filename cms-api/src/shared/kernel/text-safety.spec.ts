import { describe, expect, it } from 'vitest';
import { cleanText, safeText, stripMarkup } from './text-safety.js';

describe('text safety', () => {
  it('removes NUL and repairs lone surrogates', () => {
    expect(cleanText('a\0b\ud83d')).toBe('ab\ufffd');
  });

  it('removes tags, and keeps comparisons', () => {
    expect(stripMarkup('1 < 2 and <b>bold</b>')).toBe('1 < 2 and bold');
  });

  it('removes the content of code-bearing elements only when they close', () => {
    expect(stripMarkup('<script>a</script>b')).toBe('b');
    expect(stripMarkup('<script>a')).toBe('a');
    expect(stripMarkup('<script>a<script>b')).toBe('ab');
    expect(stripMarkup('<script>a</script')).toBe('');
  });

  it('is not fooled by characters that change length when lowercased', () => {
    const padding = '\u0130'.repeat(20);

    expect(stripMarkup(`${padding}<script>x</script>`)).toBe(padding);
  });

  it('never leaves a tag after giving up on repeated removal', () => {
    expect(stripMarkup('<'.repeat(20) + 'b>'.repeat(20))).not.toContain('<');
  });

  it('safeText does both', () => {
    expect(safeText('<scr\0ipt>x</script>y')).toBe('y');
  });
});
