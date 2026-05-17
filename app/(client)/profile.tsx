import { TopAppBar } from '@/components/ui/TopAppBar';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { formatPhone, getInitials } from '@/utils/format';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ClientProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) {
    return null;
  }

  const handleLogout = () => {
          router.replace('/(auth)/login');
          void logout();
  };

  const handleMyData = () => {
    Alert.alert('Meus dados', 'Tela de edição ainda não implementada.');
  };

  const handleNotifications = () => {
    Alert.alert('Notificações', 'Notificações ainda não implementadas.');
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
          <SettingsRow icon="notifications" label="Notificações" onPress={handleNotifications} />
        </View>

        <Pressable
          onPress={handleLogout}
          android_ripple={{ color: colors.surfaceContainerHigh }}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Encerrar sessão</Text>
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
