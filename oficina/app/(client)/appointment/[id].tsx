import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { colors, radius, shadow, spacing, typography } from '@main-mechanic/theme';
import { getApiErrorMessage, isApiError } from '@main-mechanic/wire-client';
import { useAppointmentStore } from '@/stores/appointment-store';
import { formatDate, formatTimeRange } from '@/utils/date';
import { formatPhone, getInitials, toBrazilWhatsAppPhone } from '@/utils/format';

export default function AppointmentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    selectedAppointment,
    loadedAppointmentId,
    isDetailLoading,
    error,
    fetchById,
    cancelByClient,
  } = useAppointmentStore();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const appointment = selectedAppointment?.id === id ? selectedAppointment : null;

  useEffect(() => {
    if (id) {
      void fetchById(id);
    }
  }, [id, fetchById]);

  const handleWhatsApp = () => {
    if (isCancelling) {
      return;
    }

    if (!appointment?.mechanicPhone) {
      Alert.alert('Contato indisponível', 'Número de telefone do mecânico não disponível.');
      return;
    }

    const whatsappPhone = toBrazilWhatsAppPhone(appointment.mechanicPhone);
    if (!whatsappPhone) {
      Alert.alert('Contato inválido', 'Não foi possível abrir o WhatsApp com esse número.');
      return;
    }

    const message = `Olá ${appointment.mechanicName || 'mecânico'}, sobre o meu agendamento do dia ${formatDate(appointment.date)} às ${appointment.startTime}...`;
    Linking.openURL(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const confirmCancel = async () => {
    if (!appointment || isCancelling) return;

    setCancelError(null);
    setIsCancelling(true);
    try {
      await cancelByClient(appointment.id);
      setShowCancelModal(false);
      router.replace('/(client)/bookings');
    } catch (error: unknown) {
      const code = isApiError(error) ? error.code : null;

      if (code === 'APPOINTMENT_NOT_FOUND' || code === 'APPOINTMENT_NOT_CANCELLABLE') {
        Alert.alert('Erro', getApiErrorMessage(code));
        setCancelError(getApiErrorMessage(code));
      } else {
        Alert.alert('Erro', getApiErrorMessage(code));
        setCancelError(getApiErrorMessage(code));
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCancel = () => {
    if (!appointment || isCancelling) {
      return;
    }
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    if (isCancelling) {
      return;
    }
    setShowCancelModal(false);
  };

  if (isDetailLoading || loadedAppointmentId !== id) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TopAppBar title="Detalhes" showBackButton />
        <View style={styles.notFoundWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!appointment) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TopAppBar title="Detalhes" showBackButton />
        <View style={styles.notFoundWrap}>
          <Text style={styles.notFoundText}>{error ?? getApiErrorMessage('APPOINTMENT_NOT_FOUND')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopAppBar title="Detalhes" showBackButton />
      <StatusBanner testID="appointment-status" status={appointment.status} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.detailCard}>
          <View style={styles.mechanicRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(appointment.mechanicName || 'Mecânico')}</Text>
            </View>
            <View style={styles.mechanicInfo}>
              <Text style={styles.mechanicName}>{appointment.mechanicName || 'Mecânico'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.grid}>
            <DetailTile icon="calendar-today" title="Data e Hora" value={`${formatDate(appointment.date)} ${formatTimeRange(appointment.startTime, appointment.endTime)}`} />
            <DetailTile icon="directions-car" title="Veículo" value={appointment.vehicleInfo || 'Não informado'} />
            <DetailTile icon="build" title="Serviço" value={appointment.notes || 'Sem descrição'} />
            <DetailTile icon="fact-check" title="Fechamento" value={appointment.serviceSummary || 'Nao finalizado'} />
            <DetailTile icon="troubleshoot" title="Diagnóstico" value={appointment.serviceDiagnosis || 'Nao informado'} />
            {appointment.workPerformed ? (
              <DetailTile icon="handyman" title="Serviço executado" value={appointment.workPerformed} />
            ) : null}
            {appointment.partsUsed ? (
              <DetailTile icon="construction" title="Peças utilizadas" value={appointment.partsUsed} />
            ) : null}
            {appointment.recommendations ? (
              <DetailTile icon="recommend" title="Recomendações" value={appointment.recommendations} />
            ) : null}
            {appointment.closedAt ? (
              <DetailTile
                icon="event-available"
                title="Finalizado em"
                value={new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(appointment.closedAt))}
              />
            ) : null}
            <DetailTile icon="payments" title="Valor" value={appointment.totalAmountCents ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(appointment.totalAmountCents / 100) : 'Nao informado'} />
            <DetailTile
              icon="call"
              title="Telefone"
              value={appointment.mechanicPhone ? formatPhone(appointment.mechanicPhone) : 'Não informado'}
            />
          </View>

          {appointment.serviceItems && appointment.serviceItems.length > 0 ? (
            <View style={styles.itemsSection}>
              <View style={styles.divider} />
              <Text style={styles.itemsTitle}>Itens do serviço</Text>
              {appointment.serviceItems.map((item, index) => (
                <View key={item.id ?? `${index}-${item.description}`} style={styles.itemRow}>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                  <Text style={styles.itemAmount}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(item.amountCents / 100)}
                  </Text>
                </View>
              ))}
              {appointment.totalAmountCents != null ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalAmount}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(appointment.totalAmountCents / 100)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {appointment.mechanicPhone ? (
            <PrimaryButton
              title="Falar com Mecânico"
              variant="whatsapp"
              leftIcon={<MaterialIcons name="chat" size={18} color={colors.onPrimary} />}
              onPress={handleWhatsApp}
              disabled={isCancelling}
            />
          ) : null}

          {appointment.status === 'confirmado' ? (
            <View style={styles.cancelWrap}>
              <PrimaryButton
                testID="cancel-appointment-button"
                title="Cancelar Agendamento"
                variant="outlined"
                onPress={handleCancel}
                loading={isCancelling}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={showCancelModal}
        animationType="fade"
        onRequestClose={closeCancelModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeCancelModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <MaterialIcons name="event-busy" size={24} color={colors.error} />
            </View>
            <Text style={styles.modalTitle}>Cancelar agendamento?</Text>
            <Text style={styles.modalDescription}>
              Esta ação libera o horário para novos agendamentos. Deseja continuar?
            </Text>

            {cancelError ? (
              <View testID="cancel-error" style={styles.cancelError}>
                <MaterialIcons name="error-outline" size={20} color={colors.error} />
                <Text style={styles.cancelErrorText}>{cancelError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <PrimaryButton
                title="Voltar"
                variant="outlined"
                onPress={closeCancelModal}
                disabled={isCancelling}
              />
              <PrimaryButton
                testID="confirm-cancel-button"
                title="Sim, cancelar"
                variant="filled"
                onPress={() => {
                  void confirmCancel();
                }}
                loading={isCancelling}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DetailTile({ icon, title, value }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; value: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHeader}>
        <MaterialIcons name={icon} size={16} color={colors.secondary} />
        <Text style={styles.tileTitle}>{title}</Text>
      </View>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  notFoundWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.gutterMobile,
  },
  notFoundText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  content: {
    padding: spacing.gutterMobile,
    gap: spacing.md,
  },
  detailCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.sm,
    ...shadow.medium,
  },
  mechanicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  mechanicInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  mechanicName: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  divider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginVertical: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  tile: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tileTitle: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  tileValue: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  itemsSection: {
    gap: spacing.sm,
  },
  itemsTitle: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  itemDescription: {
    ...typography.bodyMd,
    color: colors.onSurface,
    flex: 1,
  },
  itemAmount: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  totalLabel: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  totalAmount: {
    ...typography.labelMd,
    color: colors.primary,
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  cancelWrap: {
    marginTop: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing.gutterMobile,
  },
  modalCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.medium,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  modalDescription: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  cancelError: {
    borderRadius: radius.md,
    backgroundColor: colors.errorContainer,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  cancelErrorText: {
    ...typography.bodyMd,
    color: colors.error,
    flex: 1,
  },
  modalActions: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
});
