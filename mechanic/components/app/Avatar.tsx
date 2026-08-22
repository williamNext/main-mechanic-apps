import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BorderRadius, FontSize, FontWeight , useAppTheme } from '@main-mechanic/theme';

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const { colors } = useAppTheme();
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: BorderRadius.full, backgroundColor: colors.primaryLight }]}>
      <Text style={[styles.text, { color: colors.white, fontSize: size > 60 ? FontSize.lg : FontSize.md }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: FontWeight.bold },
});
