import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { BorderRadius, FontSize, FontWeight, Spacing , useAppTheme } from '@main-mechanic/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
}

export function AppButton({ title, onPress, variant = 'primary', loading, style }: AppButtonProps) {
  const { colors } = useAppTheme();
  const fill = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.error : 'transparent';
  const border = variant === 'outline' ? colors.gray300 : variant === 'secondary' ? colors.accent : fill;
  const color = variant === 'secondary' ? colors.primaryDark : variant === 'outline' ? colors.gray800 : colors.white;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={loading}
      style={[styles.base, { backgroundColor: fill, borderColor: border }, style]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={[styles.text, { color }]}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  text: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
