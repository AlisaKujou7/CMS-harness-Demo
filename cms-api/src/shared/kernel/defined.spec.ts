import { describe, expect, it } from 'vitest';
import { defined } from './defined.js';

describe('defined', () => {
  it('removes undefined and keeps every other value, including null and falsy ones', () => {
    const result = defined({ a: undefined, b: null, c: 0, d: '', e: false, f: 'x' });

    expect(result).toEqual({ b: null, c: 0, d: '', e: false, f: 'x' });
    expect(Object.keys(result)).not.toContain('a');
  });
});
