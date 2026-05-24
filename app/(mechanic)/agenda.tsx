import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, Clock3, UserRound } from 'lucide-react-native';
import { Appointment } from '@/types/models';
import { useAuthStore } from '@/stores/auth-store';
import { useAppointmentStore } from '@/stores/appointment-store';
import { colors, radius, shadow, spacing, statusTheme, typography } from '@/constants/theme';
import { formatDateFull, formatTimeRange } from '@/utils/date';

type AgendaMode = 'today' | 'upcoming' | 'pending' | 'history';

const modeLabels: Record<AgendaMode, string> = {
  today: 'Hoje',
  upcoming: 'Proximos',
  pending: 'Pendentes',
  history: 'Historico',
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isHistory(appointment: Appointment) {
  return appointment.status === 'acabado' || appointment.status === 'cancelado';
}

function filterAppointments(appointments: Appointment[], mode: AgendaMode) {
  const today = todayKey();

  return appointments
    .filter((appointment) => {
      if (mode === 'today') return appointment.date === today && appointment.status === 'confirmado';
      if (mode === 'upcoming') return appointment.date > today && appointment.status === 'confirmado';
      if (mode === 'pending') return appointment.status === 'nao_finalizado';
      return isHistory(appointment);
    })
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
}

function AppointmentRow({ appointment, onPress }: { appointment: Appointment; onPress: () => void }) {
  const theme = statusTheme[appointment.status] ?? statusTheme.confirmado;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusPill, { backgroundColor: theme.background }]}>
          <Text style={[styles.statusText, { color: theme.text }]}>{appointment.status}</Text>
        </View>
        <Text style={styles.timeText}>{formatTimeRange(appointment.startTime, appointment.endTime)}</Text>
      </View>

      <Text style={styles.clientName}>{appointment.clientName ?? 'Cliente'}</Text>
      <View style={styles.metaRow}>
        <CalendarDays size={16} color={colors.onSurfaceVariant} />
        <Text style={styles.metaText}>{formatDateFull(appointment.date)}</Text>
      </View>
      <View style={styles.metaRow}>
        <UserRound size={16} color={colors.onSurfaceVariant} />
        <Text style={styles.metaText}>{appointment.vehicleInfo || 'Veiculo nao informado'}</Text>
      </View>
      {appointment.notes ? <Text style={styles.notes} numberOfLines={2}>{appointment.notes}</Text> : null}
      {appointment.serviceSummary ? <Text style={styles.notes} numberOfLines={2}>{appointment.serviceSummary}</Text> : null}
    </Pressable>
  );
}

export default function AgendaScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { appointments, fetchByMechanic, isLoading, error } = useAppointmentStore();
  const [mode, setMode] = useState<AgendaMode>('today');

  useEffect(() => {
    if (user?.role === 'mechanic') {
      void fetchByMechanic(user.id);
    }
  }, [fetchByMechanic, user]);

  const visibleAppointments = useMemo(() => filterAppointments(appointments, mode), [appointments, mode]);
  const todayCount = useMemo(
    () => appointments.filter((appointment) => appointment.date === todayKey() && appointment.status === 'confirmado').length,
    [appointments],
  );
  const pendingCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'nao_finalizado').length,
    [appointments],
  );

  const refresh = () => {
    if (user?.role === 'mechanic') {
      void fetchByMechanic(user.id);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Acesso mecanico</Text>
        <Text style={styles.title}>Agenda</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Clock3 size={18} color={colors.safetyOrange} />
            <Text style={styles.summaryValue}>{todayCount}</Text>
            <Text style={styles.summaryLabel}>hoje</Text>
          </View>
          <View style={styles.summaryBox}>
            <CalendarDays size={18} color={colors.safetyOrange} />
            <Text style={styles.summaryValue}>{pendingCount}</Text>
            <Text style={styles.summaryLabel}>pendentes</Text>
          </View>
        </View>
      </View>

      <View style={styles.segmented}>
        {(['today', 'upcoming', 'pending', 'history'] as AgendaMode[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => setMode(item)}
            style={[styles.segment, mode === item && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{modeLabels[item]}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      >
        {visibleAppointments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhum agendamento</Text>
            <Text style={styles.emptyText}>Puxe para atualizar ou confira outro filtro da agenda.</Text>
          </View>
        ) : (
          visibleAppointments.map((appointment) => (
            <AppointmentRow
              key={appointment.id}
              appointment={appointment}
              onPress={() => router.push(`/(mechanic)/appointment/${appointment.id}`)}
            />
          ))
        )}
      </ScrollView>
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
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryBox: {
    flex: 1,
    minHeight: 86,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    padding: spacing.sm,
    justifyContent: 'space-between',
    ...shadow.light,
  },
  summaryValue: { ...typography.headlineMd, color: colors.onSurface },
  summaryLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  segmented: {
    marginHorizontal: spacing.marginMobile,
    marginBottom: spacing.sm,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    flexDirection: 'row',
  },
  segment: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.surfaceContainerLowest, ...shadow.light },
  segmentText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  segmentTextActive: { color: colors.onSurface },
  errorText: { ...typography.labelSm, color: colors.error, marginHorizontal: spacing.marginMobile },
  list: { paddingHorizontal: spacing.marginMobile, paddingBottom: 120, gap: spacing.sm },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.base,
    ...shadow.light,
  },
  pressed: { opacity: 0.82 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  statusPill: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusText: { ...typography.labelSm, textTransform: 'capitalize' },
  timeText: { ...typography.labelMd, color: colors.onSurface },
  clientName: { ...typography.headlineMd, color: colors.onSurface },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  metaText: { ...typography.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  notes: { ...typography.bodyMd, color: colors.onSurface },
  empty: {
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
