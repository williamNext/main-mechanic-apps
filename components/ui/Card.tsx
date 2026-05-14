import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BorderRadius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  style?: ViewStyle;
  padding?: keyof typeof Spacing;
}

export function Card({ children, variant = 'elevated', style, padding = 'lg' }: CardProps) {
  const { colors, theme } = useAppTheme();

  // Adjusted shadow opacity for dark mode using shadow color from theme if needed,
  // but Shadow constants are defined statically. In dark mode, shadows might not be visible
  // unless we add borders or lighten the surface. We'll add a subtle border for elevated in dark mode.
  const isDark = theme === 'dark';

  const variantStyles: Record<string, ViewStyle> = {
    elevated: {
      backgroundColor: colors.surface,
      ...(isDark ? { borderWidth: 1, borderColor: colors.gray200 } : Shadow.md),
    },
    outlined: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    filled: {
      backgroundColor: colors.gray100,
    },
  };

  return (
    <View style={[styles.base, variantStyles[variant], { padding: Spacing[padding] }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.lg,
  },
});
