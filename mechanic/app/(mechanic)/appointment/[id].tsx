import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, Car, Clock3, Phone, Plus, Trash2, UserRound } from 'lucide-react-native';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { getApiErrorMessage } from '@/services/error-messages';
import { isApiError } from '@/services/wire-client';
import { useAppointmentStore } from '@/stores/appointment-store';
import { colors, radius, shadow, spacing, statusTheme, typography } from '@/constants/theme';
import { formatDateFull, formatTimeRange } from '@/utils/date';

type ServiceItemDraft = {
  id: string;
  description: string;
  amount: string;
};

function safeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseMoneyCents(value: string) {
  const normalized = value.replace(/[^\d,.]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function formatMoney(cents?: number | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);
}

function blankItem(): ServiceItemDraft {
  return { id: `${Date.now()}-${Math.random()}`, description: '', amount: '' };
}

function ScreenErrorBanner({ message, testID }: { message: string | null; testID: string }) {
  if (!message) return null;

  return (
    <View style={styles.errorBanner} testID={testID}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export default function MechanicAppointmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointmentId = safeParam(id);
  const selectedAppointment = useAppointmentStore((state) => state.selectedAppointment);
  const loadedAppointmentId = useAppointmentStore((state) => state.loadedAppointmentId);
  const isDetailLoading = useAppointmentStore((state) => state.isDetailLoading);
  const loadError = useAppointmentStore((state) => state.error);
  const fetchById = useAppointmentStore((state) => state.fetchById);
  const cancelByMechanic = useAppointmentStore((state) => state.cancelByMechanic);
  const completeByMechanic = useAppointmentStore((state) => state.completeByMechanic);
  const [cancelling, setCancelling] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [partsUsed, setPartsUsed] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [items, setItems] = useState<ServiceItemDraft[]>([blankItem()]);

  const appointment = selectedAppointment?.id === appointmentId ? selectedAppointment : null;

  useEffect(() => {
    if (appointmentId) {
      void fetchById(appointmentId);
    }
  }, [appointmentId, fetchById]);

  const canClose = appointment?.status === 'confirmado' || appointment?.status === 'nao_finalizado';
  const totalCents = items.reduce((sum, item) => sum + (parseMoneyCents(item.amount) ?? 0), 0);

  const handleCancel = () => {
    if (!appointment || !canClose) return;
    setCancelError(null);
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    if (cancelling) return;
    setShowCancelModal(false);
  };

  const confirmCancel = async () => {
    if (!appointment || !canClose || cancelling) return;

    setCancelError(null);
    setCancelling(true);
    try {
      await cancelByMechanic(appointment.id);
      setShowCancelModal(false);
      router.back();
    } catch (error: unknown) {
      const code = isApiError(error) ? error.code : null;
      const message = getApiErrorMessage(code);
      setCancelError(message);
      Alert.alert('Falha ao cancelar', message);
    } finally {
      setCancelling(false);
    }
  };

  const handleFinish = async () => {
    if (!appointment || !canClose || finishing) return;

    setFinishError(null);

    const preparedItems = items.map((item, index) => ({
      description: item.description.trim(),
      amountCents: parseMoneyCents(item.amount),
      sortOrder: index,
    }));

    if (summary.trim().length < 3 || workPerformed.trim().length < 3) {
      const message = 'Resumo e servico executado sao obrigatorios.';
      setFinishError(message);
      Alert.alert('Revise o fechamento', message);
      return;
    }

    if (preparedItems.length === 0 || preparedItems.some((item) => !item.description || item.amountCents === null)) {
      const message = 'Informe descricao e valor valido para cada item.';
      setFinishError(message);
      Alert.alert('Revise os valores', message);
      return;
    }

    setFinishing(true);
    try {
      await completeByMechanic({
        appointmentId: appointment.id,
        summary: summary.trim(),
        diagnosis: diagnosis.trim(),
        workPerformed: workPerformed.trim(),
        partsUsed: partsUsed.trim(),
        recommendations: recommendations.trim(),
        items: preparedItems.map((item) => ({
          description: item.description,
          amountCents: item.amountCents ?? 0,
          sortOrder: item.sortOrder,
        })),
      });
      Alert.alert('Servico finalizado', 'Fechamento salvo com sucesso.');
      router.back();
    } catch (error: unknown) {
      const code = isApiError(error) ? error.code : null;
      const message = getApiErrorMessage(code);
      setFinishError(message);
      Alert.alert('Falha ao finalizar', message);
    } finally {
      setFinishing(false);
    }
  };

  if (isDetailLoading || loadedAppointmentId !== appointmentId) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Agendamento</Text>
        </View>
        <View style={styles.empty}>
          <ActivityIndicator color={colors.safetyOrange} />
        </View>
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Agendamento</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Agendamento nao encontrado</Text>
          <ScreenErrorBanner
            message={loadError ?? getApiErrorMessage('APPOINTMENT_NOT_FOUND')}
            testID="appointment-load-error-banner"
          />
        </View>
      </View>
    );
  }

  const theme = statusTheme[appointment.status] ?? statusTheme.confirmado;

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Entrada do servico</Text>
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
            <Text testID="appointment-client-name" style={styles.infoText}>{appointment.clientName ?? 'Nome nao informado'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Phone size={18} color={colors.safetyOrange} />
            <Text testID="appointment-client-phone" style={styles.infoText}>{appointment.clientPhone ?? 'Telefone oculto ou indisponivel'}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Veiculo e queixa</Text>
          <View style={styles.infoRow}>
            <Car size={18} color={colors.safetyOrange} />
            <Text style={styles.infoText}>{appointment.vehicleInfo || 'Veiculo nao informado'}</Text>
          </View>
          <Text style={styles.notes}>{appointment.notes || 'Nenhuma observacao informada.'}</Text>
        </View>

        {appointment.status === 'acabado' ? (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Servico finalizado</Text>
            <Text style={styles.infoText}>{appointment.serviceSummary ?? 'Resumo nao informado'}</Text>
            {appointment.serviceDiagnosis ? (
              <ReportField label="Diagnostico" value={appointment.serviceDiagnosis} />
            ) : null}
            {appointment.workPerformed ? (
              <ReportField label="Servico executado" value={appointment.workPerformed} />
            ) : null}
            {appointment.partsUsed ? (
              <ReportField label="Pecas utilizadas" value={appointment.partsUsed} />
            ) : null}
            {appointment.recommendations ? (
              <ReportField label="Recomendacoes" value={appointment.recommendations} />
            ) : null}
            {appointment.closedAt ? (
              <ReportField
                label="Finalizado em"
                value={new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(appointment.closedAt))}
              />
            ) : null}
            <Text style={styles.totalText}>{formatMoney(appointment.totalAmountCents)}</Text>

            {appointment.serviceItems && appointment.serviceItems.length > 0 ? (
              <View style={styles.reportItems}>
                <Text style={styles.reportLabel}>Itens do servico</Text>
                {appointment.serviceItems.map((item, index) => (
                  <View key={item.id ?? `${index}-${item.description}`} style={styles.reportItemRow}>
                    <Text style={styles.reportItemDescription}>{item.description}</Text>
                    <Text style={styles.reportItemAmount}>{formatMoney(item.amountCents)}</Text>
                  </View>
                ))}
                <View style={styles.reportTotalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalText}>{formatMoney(appointment.totalAmountCents)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {canClose ? (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Fechamento do servico</Text>
            <Field label="Resumo" value={summary} onChangeText={setSummary} testID="service-summary-input" />
            <Field label="Diagnostico" value={diagnosis} onChangeText={setDiagnosis} multiline testID="service-diagnosis-input" />
            <Field label="Servico executado" value={workPerformed} onChangeText={setWorkPerformed} multiline testID="service-work-input" />
            <Field label="Pecas usadas" value={partsUsed} onChangeText={setPartsUsed} multiline testID="service-parts-input" />
            <Field label="Recomendacoes" value={recommendations} onChangeText={setRecommendations} multiline testID="service-recommendations-input" />

            <View style={styles.itemHeader}>
              <Text style={styles.sectionTitle}>Itens e valores</Text>
              <Pressable onPress={() => setItems((current) => [...current, blankItem()])} style={styles.iconButton} testID="service-add-item-button">
                <Plus size={18} color={colors.onSurface} />
              </Pressable>
            </View>

            {items.map((item, index) => (
              <View key={item.id} style={styles.serviceItem}>
                <TextInput
                  value={item.description}
                  onChangeText={(description) => setItems((current) => current.map((next) => (next.id === item.id ? { ...next, description } : next)))}
                  placeholder="Descricao do item"
                  placeholderTextColor={colors.outline}
                  style={styles.input}
                  testID={`service-item-description-${index}`}
                />
                <TextInput
                  value={item.amount}
                  onChangeText={(amount) => setItems((current) => current.map((next) => (next.id === item.id ? { ...next, amount } : next)))}
                  placeholder="0,00"
                  placeholderTextColor={colors.outline}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.amountInput]}
                  testID={`service-item-amount-${index}`}
                />
                <Pressable
                  onPress={() => setItems((current) => (current.length === 1 ? current : current.filter((next) => next.id !== item.id)))}
                  style={styles.iconButton}
                  testID={`service-remove-item-${index}`}
                >
                  <Trash2 size={18} color={colors.error} />
                </Pressable>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalText}>{formatMoney(totalCents)}</Text>
            </View>

            <ScreenErrorBanner message={finishError} testID="appointment-finish-error-banner" />

            <PrimaryButton
              testID="appointment-finish-button"
              title="Finalizar servico"
              onPress={handleFinish}
              loading={finishing}
              disabled={finishing || cancelling}
            />
            <PrimaryButton
              title="Cancelar agendamento"
              onPress={handleCancel}
              loading={cancelling}
              disabled={finishing || cancelling}
              variant="danger"
            />
          </View>
        ) : null}
      </ScrollView>

      <Modal
        transparent
        visible={showCancelModal}
        animationType="fade"
        onRequestClose={closeCancelModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeCancelModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Cancelar agendamento?</Text>
            <Text style={styles.modalDescription}>Horario sera liberado para clientes. Deseja continuar?</Text>
            <ScreenErrorBanner message={cancelError} testID="appointment-cancel-error-banner" />
            <View style={styles.modalActions}>
              <PrimaryButton
                title="Manter"
                variant="outlined"
                onPress={closeCancelModal}
                disabled={cancelling}
              />
              <PrimaryButton
                title="Cancelar"
                variant="danger"
                onPress={() => {
                  void confirmCancel();
                }}
                loading={cancelling}
                disabled={cancelling}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ReportField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reportField}>
      <Text style={styles.reportLabel}>{label}</Text>
      <Text style={styles.infoText}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  testID: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={label}
        placeholderTextColor={colors.outline}
        style={[styles.input, multiline && styles.textarea]}
        testID={testID}
      />
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
  reportField: { gap: spacing.xs },
  reportLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'uppercase' },
  reportItems: { gap: spacing.sm },
  reportItemRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  reportItemDescription: { ...typography.bodyMd, color: colors.onSurface, flex: 1 },
  reportItemAmount: { ...typography.bodyMd, color: colors.onSurface },
  reportTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.sm,
  },
  field: { gap: 5 },
  fieldLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'uppercase' },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLowest,
    ...typography.bodyMd,
  },
  textarea: {
    minHeight: 94,
    textAlignVertical: 'top',
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.base },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  serviceItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  amountInput: { width: 110 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { ...typography.labelMd, color: colors.onSurfaceVariant },
  totalText: { ...typography.headlineMd, color: colors.onSurface },
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
