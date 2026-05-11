import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? Colors.accent : Colors.white}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              textVariantStyles[variant],
              textSizeStyles[size],
              icon ? { marginLeft: Spacing.sm } : undefined,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: FontWeight.semibold,
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: Colors.accent },
  secondary: { backgroundColor: Colors.primary },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.accent },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: Colors.error },
};

const textVariantStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: Colors.white },
  secondary: { color: Colors.white },
  outline: { color: Colors.accent },
  ghost: { color: Colors.accent },
  danger: { color: Colors.white },
};

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
  md: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  lg: { paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xxl },
};

const textSizeStyles: Record<ButtonSize, TextStyle> = {
  sm: { fontSize: FontSize.sm },
  md: { fontSize: FontSize.md },
  lg: { fontSize: FontSize.lg },
};
