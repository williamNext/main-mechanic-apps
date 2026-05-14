import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-theme';

export function Badge({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.gray100 }]}>
      <Text style={[styles.text, { color: colors.gray700 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  text: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});
