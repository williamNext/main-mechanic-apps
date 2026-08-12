import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';

interface InputFieldProps extends TextInputProps {
  label: string;
  leftIcon?: React.ReactNode;
}

export function InputField({ label, leftIcon, style, multiline, ...props }: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused, multiline && styles.multilineWrap]}>
        {leftIcon ? (
          <View pointerEvents="none" style={styles.iconSlot}>
            {leftIcon}
          </View>
        ) : null}
        <TextInput
          {...props}
          multiline={multiline}
          blurOnSubmit={props.blurOnSubmit ?? false}
          onFocus={(event) => {
            setIsFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            props.onBlur?.(event);
          }}
          placeholderTextColor={colors.outline}
          style={[
            styles.input,
            leftIcon ? styles.inputWithIcon : undefined,
            multiline && styles.multilineInput,
            style,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.base,
  },
  label: {
    ...typography.labelMd,
    color: colors.primary,
  },
  inputWrapper: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    minHeight: 50,
    justifyContent: 'center',
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 2,
  },
  multilineWrap: {
    alignItems: 'flex-start',
  },
  input: {
    ...typography.bodyMd,
    color: colors.onSurface,
    width: '100%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  inputWithIcon: {
    paddingLeft: 44,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  iconSlot: {
    position: 'absolute',
    left: spacing.sm,
    top: 14,
  },
});
