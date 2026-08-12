import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InputField } from '@/components/ui/InputField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth-store';
import { formatPhone } from '@/utils/format';

export default function LoginScreen() {
  const router = useRouter();
  const { loginByPhone, logout, isAuthActionLoading } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canSubmit = !!phone.replace(/\D/g, '') && !!password;

  async function handleLogin() {
    if (isSubmitting) return;

    setErrorMsg(null);
    const digits = phone.replace(/\D/g, '');

    if (!digits || !password) {
      setErrorMsg('Telefone e senha obrigatorios.');
      return;
    }

    if (digits.length < 10 || digits.length > 13) {
      setErrorMsg('Telefone invalido.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await loginByPhone(phone, password);
      const loggedUser = useAuthStore.getState().user;
      const isMechanic = loggedUser?.role === 'mechanic';

      if (success && isMechanic) {
        router.replace('/(mechanic)/agenda');
        return;
      }

      if (success) {
        await logout();
        setErrorMsg('Acesso de mecanico obrigatorio.');
        return;
      }

      setErrorMsg('Credenciais invalidas ou erro de conexao.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
          <View style={styles.card}>
            <View style={styles.headerBlock}>
              <View style={styles.logoContainer}>
                <MaterialIcons name="build" size={32} color={colors.onPrimary} />
              </View>
              <Text style={styles.title}>Acesso Mecanico</Text>
              <Text style={styles.subtitle}>Agenda e disponibilidade para mecanicos.</Text>
            </View>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <View style={styles.form}>
              <InputField
                label="Telefone"
                value={phone}
                onChangeText={(text) => setPhone(formatPhone(text))}
                placeholder="(51) 99999-9999"
                keyboardType="phone-pad"
                returnKeyType="next"
                leftIcon={<MaterialIcons name="call" size={18} color={colors.outline} />}
              />

              <InputField
                label="Senha"
                value={password}
                onChangeText={setPassword}
                placeholder="Digite sua senha"
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (canSubmit) handleLogin();
                }}
                leftIcon={<MaterialIcons name="lock" size={18} color={colors.outline} />}
              />

              <PrimaryButton
                title="Entrar"
                testID="login-submit-button"
                onPress={handleLogin}
                loading={isAuthActionLoading || isSubmitting}
                disabled={!canSubmit}
                variant="filled"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1 },
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
  headerBlock: { alignItems: 'center', gap: spacing.base, marginBottom: spacing.base },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.headlineLgMobile, color: colors.primary },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center' },

  form: { gap: spacing.sm, marginTop: spacing.base },
  errorText: { ...typography.labelSm, color: colors.error, marginTop: spacing.xs },
});
