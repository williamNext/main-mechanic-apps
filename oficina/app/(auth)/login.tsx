import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InputField } from '@/components/ui/InputField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, radius, shadow, spacing, typography } from '@main-mechanic/theme';
import { useAuthStore } from '@/stores/auth-store';
import { env } from '@/config/env';
import { getApiErrorMessage } from '@main-mechanic/wire-client';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { loginByEmail, isAuthActionLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canSubmit = !!email.trim() && !!password;

  async function handleLogin() {
    if (isSubmitting) return;

    setErrorMsg(null);
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setErrorMsg('Preencha e-mail e senha.');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMsg('E-mail inválido.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await loginByEmail(trimmedEmail, password);
      if (success) {
        const routeStart = Date.now();
        router.replace('/(client)/browse');
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`[auth] login route replace queued in ${Date.now() - routeStart}ms`);
        }
        return;
      }

      const storeErrorCode = useAuthStore.getState().errorCode;
      setErrorMsg(getApiErrorMessage(storeErrorCode));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
        >
          <View style={styles.card}>
            <View style={styles.headerBlock}>
              <View style={styles.logoContainer}>
                <MaterialIcons name="build" size={32} color={colors.onPrimary} />
              </View>
              <Text style={styles.title}>Mechanic Pro</Text>
              <Text style={styles.subtitle}>Gestão profissional de serviços automotivos.</Text>
            </View>

            <View style={styles.tabsRow}>
              <View style={styles.tabActive}>
                <Text style={styles.tabActiveText}>Entrar</Text>
              </View>
              <Pressable
                onPress={() => router.push('/(auth)/register')}
                android_ripple={{ color: colors.surfaceContainerHigh }}
                style={({ pressed }) => [styles.tabInactive, pressed && styles.pressed]}
              >
                <Text style={styles.tabInactiveText}>Cadastrar</Text>
              </Pressable>
            </View>

            {errorMsg ? <Text testID="login-error" style={styles.errorText}>{errorMsg}</Text> : null}

            <View style={styles.form}>
              <InputField
                testID="login-email"
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                placeholder="voce@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                leftIcon={<MaterialIcons name="mail" size={18} color={colors.outline} />}
              />

              <InputField
                testID="login-password"
                label="Senha"
                value={password}
                onChangeText={setPassword}
                placeholder="Digite sua senha"
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (canSubmit) {
                    handleLogin();
                  }
                }}
                leftIcon={<MaterialIcons name="lock" size={18} color={colors.outline} />}
              />

              <Pressable
                style={({ pressed }) => [styles.forgotWrap, pressed && styles.pressed]}
                onPress={() => setErrorMsg('Procure o suporte para redefinir sua senha.')}
                android_ripple={{ color: colors.surfaceContainerHigh }}
              >
                <Text style={styles.forgotText}>Esqueceu a senha?</Text>
              </Pressable>

              <PrimaryButton
                testID="login-submit"
                title="Entrar"
                onPress={handleLogin}
                loading={isAuthActionLoading || isSubmitting}
                disabled={!canSubmit}
                variant="filled"
              />
            </View>

            <View style={styles.bottomLinkRow}>
              <Text style={styles.bottomText}>Não tem uma conta?</Text>
              <Pressable
                onPress={() => router.push('/(auth)/register')}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.bottomActionText}>Cadastrar</Text>
              </Pressable>
            </View>

            <Text testID="backend-indicator" style={styles.backendText}>
              Servidor: {env.EXPO_PUBLIC_API_URL}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.medium,
  },
  headerBlock: {
    alignItems: 'center',
    gap: spacing.base,
    marginBottom: spacing.base,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.headlineLgMobile,
    color: colors.primary,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  tabActive: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: colors.safetyOrange,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabActiveText: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  tabInactive: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabInactiveText: {
    ...typography.bodyMd,
    color: colors.outline,
  },
  form: {
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
  },
  forgotText: {
    ...typography.labelSm,
    color: colors.safetyOrange,
    textDecorationLine: 'underline',
  },
  bottomLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    marginTop: spacing.base,
  },
  bottomText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  bottomActionText: {
    ...typography.labelMd,
    color: colors.safetyOrange,
  },
  errorText: {
    ...typography.labelSm,
    color: colors.error,
    marginTop: spacing.xs,
  },
  backendText: {
    ...typography.labelSm,
    color: colors.outline,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
});
