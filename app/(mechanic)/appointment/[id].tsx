import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, Car, Clock3, Phone, UserRound } from 'lucide-react-native';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAppointmentStore } from '@/stores/appointment-store';
import { colors, radius, shadow, spacing, statusTheme, typography } from '@/constants/theme';
import { formatDateFull, formatTimeRange } from '@/utils/date';

function safeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function MechanicAppointmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointmentId = safeParam(id);
  const appointments = useAppointmentStore((state) => state.appointments);
  const cancelByMechanic = useAppointmentStore((state) => state.cancelByMechanic);
  const [cancelling, setCancelling] = useState(false);

  const appointment = useMemo(
    () => appointments.find((item) => item.id === appointmentId),
    [appointments, appointmentId],
  );

  const handleCancel = () => {
    if (!appointment || appointment.status !== 'confirmado') return;

    Alert.alert('Cancelar agendamento?', 'O horário será reaberto para clientes se o RPC do banco permitir.', [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Cancelar',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelByMechanic(appointment.id);
          } catch (error: any) {
            Alert.alert('Falha ao cancelar', error.message || 'Tente novamente.');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (!appointment) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Appointment</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Agendamento não carregado</Text>
          <Text style={styles.emptyText}>Volte para a agenda e atualize os agendamentos atribuídos.</Text>
        </View>
      </View>
    );
  }

  const theme = statusTheme[appointment.status];

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Entrada do serviço</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={[styles.statusPill, { backgroundColor: theme.background }]}>
            <Text style={[styles.statusText, { color: theme.text }]}>{appointment.status}</Text>
          </View>
          <Text style={styles.clientName}>{appointment.clientName ?? 'Cliente'}</Text>
          <View style={styles.heroMeta}>
            <Clock3 size={17} color={colors.primaryFixed} />
            <Text style={styles.heroMetaText}>{formatTimeRange(appointment.startTime, appointment.endTime)}</Text>
          </View>
          <View style={styles.heroMeta}>
            <CalendarDays size={17} color={colors.primaryFixed} />
            <Text style={styles.heroMetaText}>{formatDateFull(appointment.date)}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <View style={styles.infoRow}>
            <UserRound size={18} color={colors.safetyOrange} />
            <Text style={styles.infoText}>{appointment.clientName ?? 'Nome não informado'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Phone size={18} color={colors.safetyOrange} />
            <Text style={styles.infoText}>{appointment.clientPhone ?? 'Telefone oculto ou indisponível'}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Veículo e queixa</Text>
          <View style={styles.infoRow}>
            <Car size={18} color={colors.safetyOrange} />
            <Text style={styles.infoText}>{appointment.vehicleInfo || 'Veículo não informado'}</Text>
          </View>
          <Text style={styles.notes}>{appointment.notes || 'Nenhuma observação informada.'}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Ações atuais do MVP</Text>
          <Text style={styles.notes}>
            Use o contexto da agenda para preparação e entrada. Ordens de serviço, orçamentos, pagamentos e mensagens ainda não estão habilitados.
          </Text>
          <PrimaryButton
            title="Cancelar agendamento"
            onPress={handleCancel}
            loading={cancelling}
            disabled={appointment.status !== 'confirmado' || cancelling}
            variant="danger"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  headerTitle: { ...typography.headlineMd, color: colors.onSurface },
  content: { paddingHorizontal: spacing.marginMobile, paddingBottom: 120, gap: spacing.sm },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    minHeight: 190,
    padding: spacing.md,
    gap: spacing.base,
    ...shadow.medium,
  },
  statusPill: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusText: { ...typography.labelSm, textTransform: 'capitalize' },
  clientName: { ...typography.headlineLgMobile, color: colors.onPrimary },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  heroMetaText: { ...typography.bodyMd, color: colors.primaryFixed },
  infoCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    gap: spacing.base,
    ...shadow.light,
  },
  sectionTitle: { ...typography.headlineMd, color: colors.onSurface },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  infoText: { ...typography.bodyMd, color: colors.onSurface, flex: 1 },
  notes: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  empty: {
    margin: spacing.marginMobile,
    minHeight: 180,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
  },
  emptyTitle: { ...typography.headlineMd, color: colors.onSurface },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center' },
});
