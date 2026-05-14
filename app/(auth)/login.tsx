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
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth-store';
import { formatPhone } from '@/utils/format';

export default function LoginScreen() {
  const router = useRouter();
  const { loginByPhone, isLoading } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin() {
    if (isSubmitting) return;

    setErrorMsg(null);
    const digits = phone.replace(/\D/g, '');

    if (!digits || !password) {
      setErrorMsg('Preencha telefone e senha.');
      return;
    }

    if (digits.length < 10 || digits.length > 13) {
      setErrorMsg('Telefone inválido.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await loginByPhone(phone, password);
      if (success) {
        router.replace('/(client)/browse');
        return;
      }

      setErrorMsg('Credenciais inválidas ou erro de conexão.');
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

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <View style={styles.form}>
              <InputField
                label="Telefone"
                value={phone}
                onChangeText={(text) => setPhone(formatPhone(text))}
                placeholder="(51) 99999-9999"
                keyboardType="phone-pad"
                leftIcon={<MaterialIcons name="call" size={18} color={colors.outline} />}
              />

              <InputField
                label="Senha"
                value={password}
                onChangeText={setPassword}
                placeholder="Digite sua senha"
                secureTextEntry
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
                title="Entrar"
                onPress={handleLogin}
                loading={isLoading || isSubmitting}
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
  pressed: {
    opacity: 0.8,
  },
});
