import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useAuth } from '@/hooks/use-auth';

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, loginByIdentifier, isAuthActionLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated && isAdmin) {
    return <Redirect href="/(admin)/dashboard" />;
  }

  const submit = async () => {
    setError(null);
    const ok = await loginByIdentifier(email, password);
    if (ok) {
      router.replace('/(admin)/dashboard');
      return;
    }
    setError('Falha no login administrativo');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Administração da Oficina</Text>
          <Text style={styles.subtitle}>Entre com uma conta administrativa confiável.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>E-mail</Text>
          <View style={styles.inputWrap}>
            <Mail size={18} color="#667085" />
            <TextInput
              value={email}
              onChangeText={(text) => setEmail(text.slice(0, 160))}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="admin@oficina.com"
              placeholderTextColor="#98a2b3"
              style={styles.input}
              onSubmitEditing={submit}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputWrap}>
            <Lock size={18} color="#667085" />
            <TextInput
              value={password}
              onChangeText={(text) => setPassword(text.slice(0, 256))}
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              placeholder="Senha"
              placeholderTextColor="#98a2b3"
              style={styles.input}
              onSubmitEditing={submit}
            />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable disabled={isAuthActionLoading} onPress={submit} style={[styles.button, isAuthActionLoading && styles.buttonDisabled]}>
          <Text style={styles.buttonText}>{isAuthActionLoading ? 'Entrando' : 'Entrar'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f8fa',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 24,
    gap: 16,
  },
  header: {
    gap: 6,
    marginBottom: 8,
  },
  title: {
    color: '#101828',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '600',
  },
  field: {
    gap: 6,
  },
  label: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '800',
  },
  inputWrap: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: '#101828',
    fontSize: 15,
    fontWeight: '600',
    outlineStyle: 'none' as never,
  },
  error: {
    color: '#b42318',
    fontSize: 13,
    fontWeight: '700',
  },
  button: {
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101828',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
