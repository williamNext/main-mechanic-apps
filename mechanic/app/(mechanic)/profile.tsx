import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BadgeCheck, UserRound } from 'lucide-react-native';
import { AppInput } from '@/components/app/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { getApiErrorMessage } from '@/services/error-messages';
import { isApiError } from '@/services/wire-client';
import { useAuthStore } from '@/stores/auth-store';
import { Mechanic } from '@/types/models';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';

function ScreenErrorBanner({ message, testID }: { message: string | null; testID: string }) {
  if (!message) return null;

  return (
    <View style={styles.errorBanner} testID={testID}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export default function MechanicProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isAuthActionLoading);
  const mechanic = user?.role === 'mechanic' ? (user as Mechanic) : null;
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (mechanic) {
      setName(mechanic.name ?? '');
      setSpecialty(mechanic.specialty ?? '');
    }
  }, [mechanic]);

  const handleSave = async () => {
    if (!mechanic) return;
    if (!name.trim() || !specialty.trim()) {
      setError('Nome e especialidade sao obrigatorios.');
      return;
    }

    setError(null);
    try {
      await updateProfile({
        name: name.trim(),
        specialty: specialty.trim(),
      });
      Alert.alert('Perfil salvo', 'Perfil publico do mecanico atualizado.');
    } catch (saveError: unknown) {
      const code = isApiError(saveError) ? saveError.code : null;
      const message = getApiErrorMessage(code);
      setError(message);
      Alert.alert('Falha ao atualizar perfil', message);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const closeLogoutModal = () => {
    if (isLoading) return;
    setShowLogoutModal(false);
  };

  const confirmLogout = async () => {
    if (isLoading) return;
    await logout();
    setShowLogoutModal(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Configuracoes</Text>
        <Text style={styles.title}>Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <UserRound size={34} color={colors.onPrimary} />
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name}>{mechanic?.name ?? 'Mecanico'}</Text>
            <Text style={styles.subtle}>{mechanic?.phone ?? 'Telefone nao definido'}</Text>
          </View>
          <View style={styles.badge}>
            <BadgeCheck size={16} color={colors.secondary} />
            <Text style={styles.badgeText}>mechanic</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Meus dados</Text>
          <AppInput label="Nome" value={name} onChangeText={setName} placeholder="Nome completo" />
          <AppInput label="Especialidade" value={specialty} onChangeText={setSpecialty} placeholder="Eletrica, freios, motor" />
          <AppInput label="Telefone" value={mechanic?.phone ?? 'Telefone nao definido'} editable={false} placeholder="Telefone" />
          <Text style={styles.helperText}>Alteracao de telefone vai exigir verificacao por codigo. Funcao fica para proxima etapa.</Text>
          <ScreenErrorBanner message={error} testID="profile-save-error-banner" />
          <PrimaryButton title="Salvar perfil" onPress={handleSave} loading={isLoading} disabled={isLoading} variant="filled" />
        </View>

        <PrimaryButton title="Sair" onPress={handleLogout} variant="outlined" />
      </ScrollView>

      <Modal
        transparent
        visible={showLogoutModal}
        animationType="fade"
        onRequestClose={closeLogoutModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeLogoutModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Sair?</Text>
            <Text style={styles.modalDescription}>A sessao local atual sera encerrada.</Text>
            <View style={styles.modalActions}>
              <PrimaryButton
                title="Cancelar"
                variant="outlined"
                onPress={closeLogoutModal}
                disabled={isLoading}
              />
              <PrimaryButton
                title="Sair"
                variant="danger"
                onPress={() => {
                  void confirmLogout();
                }}
                loading={isLoading}
                disabled={isLoading}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.base,
  },
  kicker: { ...typography.labelSm, color: colors.safetyOrange, textTransform: 'uppercase' },
  title: { ...typography.headlineLgMobile, color: colors.onSurface },
  content: { paddingHorizontal: spacing.marginMobile, paddingBottom: 120, gap: spacing.sm },
  identityCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.medium,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: 2 },
  name: { ...typography.headlineMd, color: colors.onPrimary },
  subtle: { ...typography.bodyMd, color: colors.primaryFixed },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.secondaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: { ...typography.labelSm, color: colors.secondary, textTransform: 'uppercase' },
  formCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    gap: spacing.base,
    ...shadow.light,
  },
  sectionTitle: { ...typography.headlineMd, color: colors.onSurface },
  helperText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  errorText: { ...typography.labelSm, color: colors.error },
  errorBanner: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    backgroundColor: colors.errorContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.medium,
  },
  modalTitle: { ...typography.headlineMd, color: colors.onSurface },
  modalDescription: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  modalActions: { gap: spacing.sm, marginTop: spacing.xs },
});
