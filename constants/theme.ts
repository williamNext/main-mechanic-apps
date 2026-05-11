// Design system tokens — oficina workshop aesthetic

export const Colors = {
  // Primary palette — dark navy + orange accent
  primary: '#0F1A2E',
  primaryLight: '#1A2942',
  primaryDark: '#0A1220',
  accent: '#F97316',
  accentLight: '#FB923C',
  accentDark: '#EA580C',

  // Semantic
  success: '#22C55E',
  successLight: '#4ADE80',
  warning: '#EAB308',
  error: '#EF4444',
  errorLight: '#FCA5A5',
  info: '#3B82F6',

  // Neutrals
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  black: '#000000',

  // Surfaces
  background: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceDark: '#1A2942',
  backgroundDark: '#0A1220',

  // Status-specific
  statusPending: '#F97316',
  statusConfirmed: '#22C55E',
  statusCompleted: '#3B82F6',
  statusCancelled: '#EF4444',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

export const StatusColors: Record<string, string> = {
  pending: Colors.statusPending,
  confirmed: Colors.statusConfirmed,
  completed: Colors.statusCompleted,
  cancelled: Colors.statusCancelled,
};

export const StatusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};
