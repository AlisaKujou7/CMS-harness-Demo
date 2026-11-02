const SPACING_DP = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
} as const;

export type SpacingToken = keyof typeof SPACING_DP;

export function spacing(token: SpacingToken): number {
  return SPACING_DP[token];
}
