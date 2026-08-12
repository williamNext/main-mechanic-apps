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
import * as authService from '@/services/auth-service';
import { InputField } from '@/components/ui/InputField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth-store';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapRegisterError(message: string): string {
  if (message.includes('email already registered')) {
    return 'Este e-mail já está cadastrado. Faça login.';
  }
  if (message.includes('timed out')) {
    return 'A solicitação demorou demais. Tente novamente.';
  }
  return 'Falha ao criar conta. Tente novamente.';
}

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canSubmit = !!name.trim() && !!email.trim() && !!password;

  async function handleRegister() {
    if (loading) return;

    setErrorMsg(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      setErrorMsg('Preencha todos os campos.');
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

    setLoading(true);
    try {
      const user = await authService.signUp(trimmedName, trimmedEmail, password);
      useAuthStore.getState().setUser(user);
      router.replace('/(client)/browse');
    } catch (error: any) {
      const message = error instanceof Error ? error.message : '';
      setErrorMsg(mapRegisterError(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.headerBlock}>
              <View style={styles.logoContainer}>
                <MaterialIcons name="build" size={32} color={colors.onPrimary} />
              </View>
              <Text style={styles.title}>Mechanic Pro</Text>
              <Text style={styles.subtitle}>Gestão profissional de serviços automotivos.</Text>
            </View>

            <View style={styles.tabsRow}>
              <Pressable
                onPress={() => router.push('/(auth)/login')}
                android_ripple={{ color: colors.surfaceContainerHigh }}
                style={({ pressed }) => [styles.tabInactive, pressed && styles.pressed]}
              >
                <Text style={styles.tabInactiveText}>Entrar</Text>
              </Pressable>
              <View style={styles.tabActive}>
                <Text style={styles.tabActiveText}>Cadastrar</Text>
              </View>
            </View>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
            <View style={styles.form}>
              <InputField
                label="Nome completo"
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                returnKeyType="next"
                leftIcon={<MaterialIcons name="person" size={18} color={colors.outline} />}
              />

              <InputField
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
                label="Senha"
                value={password}
                onChangeText={setPassword}
                placeholder="Crie sua senha"
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (canSubmit) {
                    handleRegister();
                  }
                }}
                leftIcon={<MaterialIcons name="lock" size={18} color={colors.outline} />}
              />

              <PrimaryButton title="Cadastrar" onPress={handleRegister} loading={loading} disabled={!canSubmit} variant="filled" />
            </View>

            <View style={styles.bottomLinkRow}>
              <Text style={styles.bottomText}>Já tem uma conta?</Text>
              <Pressable onPress={() => router.push('/(auth)/login')} style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.bottomActionText}>Entrar</Text>
              </Pressable>
            </View>
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
  pressed: {
    opacity: 0.8,
  },
});
