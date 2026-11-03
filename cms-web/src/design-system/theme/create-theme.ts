import { createTheme, type Components, type Theme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';
import { type ColorRoles, darkColors, lightColors } from '../tokens/colors';
import { duration, easing } from '../tokens/motion';
import { elevation } from '../tokens/elevation';
import { corner } from '../tokens/shape';
import { FONT_MONO, FONT_SANS, type TypeRole, typeScale } from '../tokens/typography';

type TypeVariants = Record<TypeRole, React.CSSProperties>;

declare module '@mui/material/styles' {
  interface Palette {
    md: ColorRoles;
  }
  interface PaletteOptions {
    md: ColorRoles;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- MUI's documented way to add variants.
  interface TypographyVariants extends TypeVariants {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- MUI's documented way to add variants.
  interface TypographyVariantsOptions extends Partial<TypeVariants> {}
}

declare module '@mui/material/Typography' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- MUI's documented way to add variants.
  interface TypographyPropsVariantOverrides extends Record<TypeRole, true> {}
}

export type ResolvedThemeMode = 'light' | 'dark';

const focusRing = (color: string) => ({ outline: `2px solid ${color}`, outlineOffset: 2 });

function buttonOverrides(colors: ColorRoles): NonNullable<Components<Theme>['MuiButton']> {
  return {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        ...typeScale.labelLarge,
        textTransform: 'none',
        borderRadius: corner.full,
        minHeight: 40,
        paddingInline: 24,
        '&.Mui-focusVisible': focusRing(colors.primary),
      },
    },
  };
}

function surfaceOverrides(colors: ColorRoles): Components<Theme> {
  return {
    MuiCard: {
      styleOverrides: { root: { borderRadius: corner.medium, backgroundImage: 'none' } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: corner.extraLarge,
          backgroundColor: colors.surfaceContainerHigh,
          boxShadow: elevation.level4,
          minWidth: 280,
          maxWidth: 560,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: corner.extraSmall,
          backgroundColor: colors.surfaceContainer,
          boxShadow: elevation.level2,
        },
      },
    },
    MuiTooltip: { styleOverrides: { tooltip: { ...typeScale.bodySmall } } },
  };
}

function controlOverrides(colors: ColorRoles): Components<Theme> {
  return {
    MuiButton: buttonOverrides(colors),
    MuiIconButton: {
      styleOverrides: { root: { '&.Mui-focusVisible': focusRing(colors.primary) } },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          ...typeScale.labelLarge,
          borderRadius: corner.small,
          '&.Mui-focusVisible': focusRing(colors.primary),
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: { borderRadius: `${String(corner.extraSmall)}px ${String(corner.extraSmall)}px 0 0` },
      },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: corner.extraSmall } } },
    MuiTab: { styleOverrides: { root: { ...typeScale.titleSmall, textTransform: 'none' } } },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiTableCell: {
      styleOverrides: {
        root: { ...typeScale.bodyMedium, borderColor: colors.outlineVariant },
        head: { ...typeScale.titleSmall, backgroundColor: colors.surfaceContainer },
      },
    },
  };
}

// 03-DESIGN 9.4 and 17.5
const REDUCED_MOTION = {
  '@media (prefers-reduced-motion: reduce)': {
    '*, *::before, *::after': {
      transitionDuration: `${String(duration.short1)}ms !important`,
      animation: 'none !important',
    },
  },
};

const TRANSITIONS = {
  easing: {
    easeInOut: easing.standard,
    easeOut: easing.standardDecelerate,
    easeIn: easing.standardAccelerate,
    sharp: easing.emphasized,
  },
  duration: {
    shortest: duration.short2,
    shorter: duration.short3,
    short: duration.short4,
    standard: duration.medium2,
    complex: duration.medium3,
    enteringScreen: duration.medium1,
    leavingScreen: duration.short4,
  },
};

export function createCmsTheme(mode: ResolvedThemeMode): Theme {
  const md = mode === 'dark' ? darkColors : lightColors;
  return createTheme({
    palette: {
      mode,
      md,
      primary: { main: md.primary, contrastText: md.onPrimary },
      secondary: { main: md.secondary, contrastText: md.onSecondary },
      error: { main: md.error, contrastText: md.onError },
      success: { main: md.success, contrastText: md.onSuccess },
      background: { default: md.surface, paper: md.surfaceContainerLow },
      text: { primary: md.onSurface, secondary: md.onSurfaceVariant },
      divider: md.outlineVariant,
    },
    typography: {
      fontFamily: FONT_SANS,
      ...typeScale,
      button: { ...typeScale.labelLarge },
    },
    shape: { borderRadius: corner.extraSmall },
    transitions: TRANSITIONS,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: md.surface, color: md.onSurface },
          code: { fontFamily: FONT_MONO },
          pre: { fontFamily: FONT_MONO },
          ...REDUCED_MOTION,
        },
      },
      ...controlOverrides(md),
      ...surfaceOverrides(md),
    },
  });
}
