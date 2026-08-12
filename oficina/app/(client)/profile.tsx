import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppInput } from '@/components/app/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { formatPhone, getInitials } from '@/utils/format';

export default function ClientProfileScreen() {
  const { user, logout, updateProfile, isAuthActionLoading } = useAuth();
  const router = useRouter();
  const [showMyData, setShowMyData] = useState(false);
  const [name, setName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setName(user.name ?? '');
  }, [user]);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    router.replace('/(auth)/login');
    void logout();
  };

  const handleMyData = () => {
    setShowMyData((current) => !current);
  };

  const handleNotifications = () => {
    router.push('/(client)/notifications' as any);
  };

  const handleSaveData = async () => {
    const nextName = name.trim();
    if (nextName.length < 2) {
      setSaveError('Nome deve ter pelo menos 2 caracteres.');
      return;
    }

    setSaveError(null);
    try {
      await updateProfile({ name: nextName });
      Alert.alert('Dados salvos', 'Seu perfil foi atualizado.');
    } catch (error: any) {
      setSaveError(error?.message || 'Falha ao salvar dados.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopAppBar showBackButton={false} onProfilePress={() => undefined} />

      <View style={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userPhone}>{formatPhone(user.phone || '')}</Text>
        </View>

        <View style={styles.settingsList}>
          <SettingsRow icon="person" label="Meus Dados" onPress={handleMyData} />
          <SettingsRow icon="notifications" label="Notificacoes" onPress={handleNotifications} />
        </View>

        {showMyData ? (
          <View style={styles.dataCard}>
            <Text style={styles.sectionTitle}>Meus dados</Text>
            <AppInput label="Nome" value={name} onChangeText={setName} placeholder="Nome completo" />
            <AppInput
              label="Telefone"
              value={formatPhone(user.phone || '')}
              editable={false}
              placeholder="Telefone"
            />
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
            <PrimaryButton
              title="Salvar dados"
              onPress={handleSaveData}
              loading={isAuthActionLoading}
              disabled={isAuthActionLoading}
              variant="filled"
            />
          </View>
        ) : null}

        <Pressable
          onPress={handleLogout}
          android_ripple={{ color: colors.surfaceContainerHigh }}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Encerrar sessao</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.surfaceContainerHigh }}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
    >
      <View style={styles.settingsLeft}>
        <MaterialIcons name={icon} size={18} color={colors.secondary} />
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={colors.outlineVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.gutterMobile,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  profileHeader: {
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadow.medium,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.surfaceContainerHigh,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.headlineMd,
    color: colors.primary,
  },
  userName: {
    ...typography.headlineMd,
    color: colors.onPrimary,
    marginTop: spacing.sm,
  },
  userPhone: {
    ...typography.labelMd,
    color: colors.primaryFixed,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  settingsList: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  settingsRow: {
    minHeight: 58,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsLabel: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  dataCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.sm,
    ...shadow.light,
  },
  sectionTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.labelSm,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  logoutButton: {
    borderRadius: radius.lg,
    backgroundColor: colors.errorContainer,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  logoutText: {
    ...typography.labelMd,
    color: colors.error,
  },
  pressed: {
    opacity: 0.85,
  },
});
