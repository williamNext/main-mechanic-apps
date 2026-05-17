import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { BorderRadius, FontSize, FontWeight, getStatusColor, Spacing, StatusLabels } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  const { colors } = useAppTheme();

  const variantBg: Record<BadgeVariant, ViewStyle> = {
    default: { backgroundColor: colors.gray100 },
    success: { backgroundColor: colors.success + '1A' },
    warning: { backgroundColor: colors.warning + '1A' },
    error: { backgroundColor: colors.error + '1A' },
    info: { backgroundColor: colors.info + '1A' },
  };

  const variantText: Record<BadgeVariant, { color: string }> = {
    default: { color: colors.gray700 },
    success: { color: colors.success },
    warning: { color: colors.warning },
    error: { color: colors.error },
    info: { color: colors.info },
  };

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
  const { colors } = useAppTheme();
  const color = getStatusColor(status, colors);
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
