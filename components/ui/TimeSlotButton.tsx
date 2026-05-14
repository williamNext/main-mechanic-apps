import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';

interface TimeSlotButtonProps {
  label: string;
  selected?: boolean;
  unavailable?: boolean;
  onPress?: () => void;
}

export function TimeSlotButton({
  label,
  selected = false,
  unavailable = false,
  onPress,
}: TimeSlotButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={unavailable}
      android_ripple={{ color: colors.surfaceContainerHigh }}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.available,
        unavailable && styles.unavailable,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.text,
          selected ? styles.selectedText : styles.availableText,
          unavailable && styles.unavailableText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
  },
  available: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.outlineVariant,
  },
  selected: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.secondaryContainer,
    ...shadow.coral,
  },
  unavailable: {
    opacity: 0.4,
  },
  text: {
    ...typography.labelMd,
  },
  availableText: {
    color: colors.primary,
  },
  selectedText: {
    color: colors.onPrimary,
  },
  unavailableText: {
    textDecorationLine: 'line-through',
  },
  pressed: {
    opacity: 0.9,
  },
});
