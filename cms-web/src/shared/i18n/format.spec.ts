import { describe, expect, it } from 'vitest';
import { format } from './format';

describe('format', () => {
  it('fills in every placeholder', () => {
    expect(format('{a} of {b}, {a} again', { a: 1, b: 'two' })).toBe('1 of two, 1 again');
  });

  it('leaves a placeholder it has no value for', () => {
    expect(format('Hello {name}', {})).toBe('Hello {name}');
  });
});
