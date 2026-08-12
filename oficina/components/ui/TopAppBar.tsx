import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography } from '@/constants/theme';

interface TopAppBarProps {
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  onProfilePress?: () => void;
  leftIcon?: keyof typeof MaterialIcons.glyphMap;
}

export function TopAppBar({
  title = 'Mechanic Pro',
  showBackButton = true,
  onBackPress,
  onProfilePress,
  leftIcon = 'arrow-back',
}: TopAppBarProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    router.back();
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {showBackButton ? (
          <Pressable
            onPress={handleBack}
            android_ripple={{ color: colors.surfaceContainer }}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name={leftIcon} size={22} color={colors.onSurfaceVariant} />
          </Pressable>
        ) : (
          <View style={styles.iconButton}>
            <MaterialIcons name="build" size={22} color={colors.onSurfaceVariant} />
          </View>
        )}

        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>

        <Pressable
          testID="topbar-profile"
          onPress={onProfilePress}
          android_ripple={{ color: colors.surfaceContainer }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Perfil"
        >
          <MaterialIcons name="account-circle" size={24} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  container: {
    height: 64,
    paddingHorizontal: spacing.gutterMobile,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    height: 40,
    width: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  title: {
    ...typography.headlineMd,
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
  },
});
