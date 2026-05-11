import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/auth-store';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { loginByEmail, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin() {
    setErrorMsg(null);
    if (!email || !password) {
      setErrorMsg('Preencha email e senha');
      return;
    }

    const success = await loginByEmail(email, password);
    if (success) {
      router.replace('/(client)/browse');
    } else {
      setErrorMsg('Credenciais inválidas ou erro de conexão.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="car-sport" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Oficina</Text>
          <Text style={styles.subtitle}>Para Clientes</Text>
        </View>

        <View style={styles.form}>
          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            icon={<Ionicons name="mail-outline" size={18} color={Colors.gray400} />}
          />

          <Input
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder="Sua senha"
            secureTextEntry
            icon={<Ionicons name="lock-closed-outline" size={18} color={Colors.gray400} />}
          />

          <Button
            title="Entrar"
            onPress={handleLogin}
            loading={isLoading}
            size="lg"
            style={styles.submitBtn}
          />

          <Button
            title="Não tem conta? Cadastre-se"
            onPress={() => router.push('/(auth)/register')}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl * 2,
    paddingBottom: Spacing.xxxl,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.gray400,
    marginTop: Spacing.xs,
  },
  form: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error + '20',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    flex: 1,
  },
  submitBtn: {
    marginTop: Spacing.lg,
  },
});
