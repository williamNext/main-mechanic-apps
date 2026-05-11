import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Role } from '@/types/models';
import * as authService from '@/services/auth-service';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleRegister() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name || !email || !password) {
      setErrorMsg('Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      await authService.signUp(email, password, name, 'client');
      setSuccessMsg('Conta criada! Faça login para continuar.');
      // Optional: auto-redirect after a delay, but letting them read it is good.
    } catch (error: any) {
      setErrorMsg(error.message || 'Falha ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Criar Conta</Text>
          <Text style={styles.subtitle}>Junte-se à nossa plataforma</Text>
        </View>

        <View style={styles.form}>
          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={[styles.errorContainer, { backgroundColor: Colors.accent + '20' }]}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
              <Text style={[styles.errorText, { color: Colors.accent }]}>{successMsg}</Text>
            </View>
          ) : null}

          <Input
            label="Nome Completo"
            value={name}
            onChangeText={setName}
            placeholder="Seu nome"
            icon={<Ionicons name="person-outline" size={18} color={Colors.gray400} />}
          />

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
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            icon={<Ionicons name="lock-closed-outline" size={18} color={Colors.gray400} />}
          />

          <Button
            title="Registrar"
            onPress={handleRegister}
            loading={loading}
            size="lg"
            style={styles.submitBtn}
          />

          <Button
            title="Já tenho conta? Login"
            onPress={() => router.back()}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Re-using styles from Login where possible
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  header: {
    padding: Spacing.xxxl,
    paddingTop: Spacing.xxxl * 2,
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
  roleTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.gray400,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleOptionActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  roleText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.gray400,
  },
  roleTextActive: {
    color: Colors.white,
  },
  submitBtn: {
    marginTop: Spacing.lg,
  },
});

import { TouchableOpacity } from 'react-native'; // Fix for missing import
