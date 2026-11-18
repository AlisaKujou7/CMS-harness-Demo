import { describe, expect, it } from 'vitest';
import { darkColors, lightColors } from '../tokens/colors';
import { createCmsTheme } from './create-theme';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

describe('createCmsTheme', () => {
  it('uses the light roles from 03-DESIGN 6.1', () => {
    const theme = createCmsTheme('light');

    expect(theme.palette.mode).toBe('light');
    expect(theme.palette.primary.main).toBe('#6750A4');
    expect(theme.palette.md.surface).toBe('#FEF7FF');
  });

  it('uses the dark roles from 03-DESIGN 18.2', () => {
    const theme = createCmsTheme('dark');

    expect(theme.palette.mode).toBe('dark');
    expect(theme.palette.primary.main).toBe('#D0BCFF');
    expect(theme.palette.background.default).toBe('#141218');
  });

  it('applies the type scale from 03-DESIGN 5.1', () => {
    expect(createCmsTheme('light').typography.headlineLarge).toMatchObject({
      fontSize: '2rem',
      lineHeight: '2.5rem',
      fontWeight: 400,
    });
  });

  // 03-DESIGN 6.4: WCAG 2.1 AA for every role pair the status chips and body text use.
  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as const)('keeps role pairs at 4.5:1 or better in %s', (_mode, colors) => {
    const pairs = [
      [colors.onSurface, colors.surface],
      [colors.onSurfaceVariant, colors.surface],
      [colors.onSurfaceVariant, colors.surfaceContainerHigh],
      [colors.onPrimary, colors.primary],
      [colors.onSecondaryContainer, colors.secondaryContainer],
      [colors.onTertiaryContainer, colors.tertiaryContainer],
      [colors.onSuccessContainer, colors.successContainer],
      [colors.onErrorContainer, colors.errorContainer],
      [colors.inverseOnSurface, colors.inverseSurface],
    ] as const;

    for (const [text, background] of pairs) {
      expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
