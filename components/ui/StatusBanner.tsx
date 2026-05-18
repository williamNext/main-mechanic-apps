import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { spacing, statusTheme, StatusLabels, typography } from '@/constants/theme';

interface StatusBannerProps {
  status: keyof typeof statusTheme | string;
}

export function StatusBanner({ status }: StatusBannerProps) {
  const safeStatus = (statusTheme as Record<string, (typeof statusTheme)[keyof typeof statusTheme]>)[status] || statusTheme.confirmado;
  const safeLabel = StatusLabels[status] || status;

  return (
    <View style={[styles.container, { backgroundColor: safeStatus.background }]}> 
      <MaterialIcons name={safeStatus.icon as keyof typeof MaterialIcons.glyphMap} size={22} color={safeStatus.text} />
      <Text style={[styles.label, { color: safeStatus.text }]}>{safeLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    paddingHorizontal: spacing.gutterMobile,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  label: {
    ...typography.headlineMd,
  },
});
