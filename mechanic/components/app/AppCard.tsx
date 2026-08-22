import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BorderRadius, Shadow, Spacing , useAppTheme } from '@main-mechanic/theme';

export function AppCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useAppTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface }, Shadow.md, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
});
