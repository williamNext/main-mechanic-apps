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
import { formatPhone } from '@/utils/format';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canSubmit = !!name.trim() && !!phone.replace(/\D/g, '') && !!password;

  async function handleRegister() {
    if (loading) return;

    setErrorMsg(null);

    if (!name || !phone || !password) {
      setErrorMsg('Preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      await authService.signUpWithPhone(phone, password, name, 'client');
      router.replace('/(client)/browse');
    } catch (error: any) {
      setErrorMsg(error.message || 'Falha ao criar conta.');
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
