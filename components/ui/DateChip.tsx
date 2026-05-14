import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';

interface DateChipProps {
  dayLabel: string;
  dayNumber: string;
  active?: boolean;
  onPress?: () => void;
}

export function DateChip({ dayLabel, dayNumber, active = false, onPress }: DateChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.base, active ? styles.active : styles.inactive, pressed && styles.pressed]}
      android_ripple={{ color: colors.surfaceContainerHigh }}
      accessibilityRole="button"
    >
      <View style={styles.inner}>
        <Text style={[styles.dayLabel, active && styles.activeText]}>{dayLabel}</Text>
        <Text style={[styles.dayNumber, active && styles.activeText]}>{dayNumber}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  inactive: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.outlineVariant,
  },
  active: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadow.light,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dayLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  dayNumber: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  activeText: {
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.85,
  },
});
