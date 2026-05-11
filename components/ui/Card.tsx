import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Shadow, Spacing } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  style?: ViewStyle;
  padding?: keyof typeof Spacing;
}

export function Card({ children, variant = 'elevated', style, padding = 'lg' }: CardProps) {
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

const variantStyles: Record<string, ViewStyle> = {
  elevated: {
    backgroundColor: Colors.surface,
    ...Shadow.md,
  },
  outlined: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  filled: {
    backgroundColor: Colors.gray100,
  },
};
