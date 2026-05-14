export const colors = {
  primary: '#181f21',
  onPrimary: '#ffffff',
  primaryContainer: '#2d3436',
  primaryFixed: '#dde4e6',
  secondary: '#a83639',
  onSecondary: '#ffffff',
  secondaryContainer: '#ff7675',
  onSecondaryContainer: '#720b16',
  background: '#f9f9f9',
  surface: '#f9f9f9',
  surfaceContainer: '#eeeeee',
  surfaceContainerLow: '#f3f3f3',
  surfaceContainerHigh: '#e8e8e8',
  surfaceContainerLowest: '#ffffff',
  outline: '#747879',
  outlineVariant: '#c3c7c8',
  onBackground: '#1a1c1c',
  onSurface: '#1a1c1c',
  onSurfaceVariant: '#434749',
  safetyOrange: '#ff6b00',
  whatsapp: '#25d366',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  shadowBase: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 12,
  base: 8,
  md: 24,
  lg: 40,
  xl: 64,
  gutterMobile: 16,
  gutterDesktop: 24,
  marginMobile: 20,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const typography = {
  headlineXl: {
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -0.96,
    fontFamily: fontFamilies.extrabold,
  },
  headlineLg: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.32,
    fontFamily: fontFamilies.bold,
  },
  headlineLgMobile: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: fontFamilies.bold,
  },
  headlineMd: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fontFamilies.semibold,
  },
  bodyLg: {
    fontSize: 18,
    lineHeight: 28,
    fontFamily: fontFamilies.regular,
  },
  bodyMd: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fontFamilies.regular,
  },
  labelMd: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.7,
    fontFamily: fontFamilies.semibold,
  },
  labelSm: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamilies.medium,
  },
} as const;

export const shadow = {
  light: {
    shadowColor: colors.shadowBase,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.shadowBase,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  coral: {
    shadowColor: colors.secondaryContainer,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;

export const StatusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const statusTheme = {
  pending: {
    background: colors.primary,
    text: colors.onPrimary,
    icon: 'schedule',
  },
  confirmed: {
    background: colors.primary,
    text: colors.onPrimary,
    icon: 'schedule',
  },
  in_progress: {
    background: colors.secondary,
    text: colors.onSecondary,
    icon: 'build-circle',
  },
  completed: {
    background: colors.surfaceContainerHigh,
    text: colors.onSurface,
    icon: 'check-circle',
  },
  cancelled: {
    background: colors.errorContainer,
    text: colors.error,
    icon: 'cancel',
  },
} as const;

export const Colors = {
  light: {
    ...colors,
    primaryLight: colors.primaryContainer,
    primaryDark: colors.primary,
    accent: colors.safetyOrange,
    accentLight: colors.secondaryContainer,
    accentDark: colors.secondary,
    success: colors.secondary,
    warning: colors.safetyOrange,
    info: colors.primary,
    white: colors.surfaceContainerLowest,
    black: colors.onSurface,
    gray50: colors.surfaceContainerLowest,
    gray100: colors.surfaceContainerLow,
    gray200: colors.surfaceContainer,
    gray300: colors.surfaceContainerHigh,
    gray400: colors.outlineVariant,
    gray500: colors.outline,
    gray600: colors.onSurfaceVariant,
    gray700: colors.onSurface,
    gray800: colors.onBackground,
    gray900: colors.onSurface,
    text: colors.onSurface,
    icon: colors.onSurfaceVariant,
    tint: colors.primary,
    tabIconDefault: colors.onSurfaceVariant,
    tabIconSelected: colors.secondary,
    statusPending: colors.primary,
    statusConfirmed: colors.secondary,
    statusCompleted: colors.surfaceContainerHigh,
    statusCancelled: colors.error,
  },
  dark: {
    ...colors,
    primaryLight: colors.primaryContainer,
    primaryDark: colors.primary,
    accent: colors.safetyOrange,
    accentLight: colors.secondaryContainer,
    accentDark: colors.secondary,
    success: colors.secondary,
    warning: colors.safetyOrange,
    info: colors.primary,
    white: colors.surfaceContainerLowest,
    black: colors.onSurface,
    gray50: colors.surfaceContainerLowest,
    gray100: colors.surfaceContainerLow,
    gray200: colors.surfaceContainer,
    gray300: colors.surfaceContainerHigh,
    gray400: colors.outlineVariant,
    gray500: colors.outline,
    gray600: colors.onSurfaceVariant,
    gray700: colors.onSurface,
    gray800: colors.onBackground,
    gray900: colors.onSurface,
    text: colors.onSurface,
    icon: colors.onSurfaceVariant,
    tint: colors.primary,
    tabIconDefault: colors.onSurfaceVariant,
    tabIconSelected: colors.secondary,
    statusPending: colors.primary,
    statusConfirmed: colors.secondary,
    statusCompleted: colors.surfaceContainerHigh,
    statusCancelled: colors.error,
  },
} as const;

export const Spacing = {
  xs: spacing.xs,
  sm: spacing.base,
  md: 16,
  lg: spacing.md,
  xl: 32,
  xxl: spacing.lg,
  xxxl: spacing.xl,
} as const;

export const BorderRadius = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  xl: 16,
  full: radius.full,
} as const;

export const FontSize = {
  xs: 11,
  sm: typography.labelSm.fontSize,
  md: typography.bodyMd.fontSize,
  lg: 18,
  xl: typography.headlineMd.fontSize,
  xxl: typography.headlineLgMobile.fontSize,
  xxxl: typography.headlineLg.fontSize,
  hero: typography.headlineXl.fontSize,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const LayoutMetrics = {
  tabBarHeight: 80,
  tabBarBottomPadding: 0,
  ctaHeight: 56,
  ctaGapFromTabs: 12,
} as const;

export const Shadow = {
  sm: shadow.light,
  md: shadow.medium,
  lg: shadow.medium,
} as const;

export function getStatusColor(status: string, palette: typeof Colors.light) {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return palette.statusPending;
    case 'in_progress':
      return palette.statusConfirmed;
    case 'completed':
      return palette.statusCompleted;
    case 'cancelled':
      return palette.statusCancelled;
    default:
      return palette.gray500;
  }
}
