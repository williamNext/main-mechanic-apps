import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-theme';

interface AppInputProps extends TextInputProps {
  label: string;
  leftIcon?: React.ReactNode;
  error?: string | null;
  secureToggle?: boolean;
}

export function AppInput({ label, leftIcon, error, secureToggle, secureTextEntry, ...props }: AppInputProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  const { colors } = useAppTheme();
  const borderColor = error ? colors.error : focused ? colors.primary : colors.gray200;

  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: colors.gray700 }]}>{label}</Text>
      <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor }]}>
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          style={[styles.input, { color: colors.gray900 }]}
          placeholderTextColor={colors.gray400}
        />
        {secureToggle ? (
          <TouchableOpacity onPress={() => setHidden((v) => !v)} style={styles.eye}>
            {hidden ? <Eye size={18} color={colors.gray500} /> : <EyeOff size={18} color={colors.gray500} />}
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.xs },
  wrap: {
    minHeight: 54,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  icon: { marginHorizontal: Spacing.xs },
  input: { flex: 1, fontSize: FontSize.md, paddingHorizontal: Spacing.xs, paddingVertical: Spacing.sm },
  eye: { padding: Spacing.xs },
  error: { marginTop: Spacing.xs, fontSize: FontSize.xs, fontWeight: FontWeight.medium },
});
