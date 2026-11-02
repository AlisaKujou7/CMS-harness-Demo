import { describe, expect, it } from 'vitest';
import { spacing } from './spacing';

describe('spacing', () => {
  it.each([
    [1, 4],
    [2, 8],
    [3, 12],
    [4, 16],
    [5, 20],
    [6, 24],
    [7, 32],
    [8, 40],
    [9, 48],
  ] as const)('maps token spacing.%i to %i dp as in 03-DESIGN 4.2', (token, dp) => {
    expect(spacing(token)).toBe(dp);
  });
});
