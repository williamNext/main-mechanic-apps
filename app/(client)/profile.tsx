import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/use-auth';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { formatPhone } from '@/utils/format';

export default function ClientProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace('/(auth)/login');
  }

  if (!user) return null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.avatarSection}>
        <Avatar name={user.name} size="xl" />
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.content}>
        <Card>
          <InfoRow icon="mail-outline" label="Email" value={user.email} />
          <InfoRow icon="call-outline" label="Telefone" value={formatPhone(user.phone ?? '')} />
        </Card>

        <Button
          title="Sair da Conta"
          onPress={handleLogout}
          variant="outline"
          size="lg"
          style={styles.logoutBtn}
          icon={<Ionicons name="log-out-outline" size={18} color={Colors.accent} />}
        />
      </View>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.gray400} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    backgroundColor: Colors.white,
    gap: Spacing.xs,
  },
  name: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.gray900,
    marginTop: Spacing.sm,
  },
  email: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
  },
  content: {
    padding: Spacing.xxl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
    gap: Spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: FontSize.md,
    color: Colors.gray900,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: Spacing.xxl,
  },
});
