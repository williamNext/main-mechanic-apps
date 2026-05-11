import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { StatusColors, StatusLabels } from '@/constants/theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  return (
    <View style={[styles.base, variantBg[variant], style]}>
      <Text style={[styles.text, variantText[variant]]}>{label}</Text>
    </View>
  );
}

interface StatusBadgeProps {
  status: string;
  style?: ViewStyle;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const color = StatusColors[status] ?? Colors.gray500;
  const label = StatusLabels[status] ?? status;

  return (
    <View style={[styles.base, { backgroundColor: color + '1A' }, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});

const variantBg: Record<BadgeVariant, ViewStyle> = {
  default: { backgroundColor: Colors.gray100 },
  success: { backgroundColor: Colors.success + '1A' },
  warning: { backgroundColor: Colors.warning + '1A' },
  error: { backgroundColor: Colors.error + '1A' },
  info: { backgroundColor: Colors.info + '1A' },
};

const variantText: Record<BadgeVariant, { color: string }> = {
  default: { color: Colors.gray700 },
  success: { color: Colors.success },
  warning: { color: Colors.warning },
  error: { color: Colors.error },
  info: { color: Colors.info },
};
