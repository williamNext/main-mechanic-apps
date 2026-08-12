import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  keyboardAware?: boolean;
  contentStyle?: object;
}

export function ScreenContainer({ children, scroll = false, keyboardAware = false, contentStyle }: ScreenContainerProps) {
  const { colors } = useAppTheme();
  const content = scroll ? (
    <ScrollView contentContainerStyle={[styles.scrollContent, contentStyle]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {keyboardAware ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, padding: Spacing.lg },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
});
