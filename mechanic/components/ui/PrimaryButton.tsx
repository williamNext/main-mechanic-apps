import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, shadow, spacing, typography } from '@main-mechanic/theme';

type PrimaryButtonVariant = 'filled' | 'outlined' | 'whatsapp' | 'secondary' | 'danger';

interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: PrimaryButtonVariant;
  loading?: boolean;
  leftIcon?: React.ReactNode;
}

export function PrimaryButton({
  title,
  variant = 'filled',
  loading = false,
  leftIcon,
  disabled,
  ...props
}: PrimaryButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const runScale = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 25,
      bounciness: 0,
    }).start();
  };

  const isDisabled = disabled || loading;

  return (
    <Animated.View style={[styles.outer, { transform: [{ scale }] }]}>
      <Pressable
        {...props}
        disabled={isDisabled}
        onPressIn={(event) => {
          runScale(0.98);
          props.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          runScale(1);
          props.onPressOut?.(event);
        }}
        android_ripple={{ color: colors.surfaceContainerHigh }}
        style={({ pressed }) => [
          styles.button,
          variantStyles[variant],
          pressed && styles.pressed,
          isDisabled && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variantTextStyles[variant].color} />
        ) : (
          <View style={styles.content}>
            {leftIcon}
            <Text style={[styles.title, variantTextStyles[variant]]}>{title}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const variantStyles = StyleSheet.create({
  filled: {
    backgroundColor: colors.safetyOrange,
    borderColor: colors.safetyOrange,
  },
  outlined: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.primary,
  },
  whatsapp: {
    backgroundColor: colors.whatsapp,
    borderColor: colors.whatsapp,
  },
  secondary: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.secondaryContainer,
    ...shadow.coral,
  },
  danger: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
});

const variantTextStyles = StyleSheet.create({
  filled: {
    color: colors.onPrimary,
  },
  outlined: {
    color: colors.primary,
  },
  whatsapp: {
    color: colors.onPrimary,
  },
  secondary: {
    color: colors.onPrimary,
  },
  danger: {
    color: colors.onPrimary,
  },
});

const styles = StyleSheet.create({
  outer: {
    width: '100%',
  },
  button: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  title: {
    ...typography.labelMd,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.55,
  },
});
