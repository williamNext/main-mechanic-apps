import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Colors, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { getInitials } from '@/utils/format';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: FontSize.xs,
  md: FontSize.sm,
  lg: FontSize.lg,
  xl: FontSize.xxl,
};

export function Avatar({ name, imageUrl, size = 'md', style }: AvatarProps) {
  const dimension = sizeMap[size];

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
          },
          style,
        ]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: fontSizeMap[size] }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
  },
});
