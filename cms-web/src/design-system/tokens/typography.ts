export const FONT_SANS = '"Roboto Flex Variable", "Roboto Flex", Roboto, system-ui, sans-serif';
export const FONT_MONO = '"Roboto Mono", ui-monospace, monospace';

interface TypeStyle {
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly fontWeight: number;
  readonly letterSpacing: string;
}

const style = (size: number, line: number, weight: number, tracking: number): TypeStyle => ({
  fontSize: `${String(size / 16)}rem`,
  lineHeight: `${String(line / 16)}rem`,
  fontWeight: weight,
  letterSpacing: `${String(tracking)}px`,
});

// 03-DESIGN 5.1
export const typeScale = {
  displayLarge: style(57, 64, 400, -0.25),
  displayMedium: style(45, 52, 400, 0),
  displaySmall: style(36, 44, 400, 0),
  headlineLarge: style(32, 40, 400, 0),
  headlineMedium: style(28, 36, 400, 0),
  headlineSmall: style(24, 32, 400, 0),
  titleLarge: style(22, 28, 500, 0),
  titleMedium: style(16, 24, 500, 0.15),
  titleSmall: style(14, 20, 500, 0.1),
  bodyLarge: style(16, 24, 400, 0.5),
  bodyMedium: style(14, 20, 400, 0.25),
  bodySmall: style(12, 16, 400, 0.4),
  labelLarge: style(14, 20, 500, 0.1),
  labelMedium: style(12, 16, 500, 0.5),
  labelSmall: style(11, 16, 500, 0.5),
} as const;

export type TypeRole = keyof typeof typeScale;
