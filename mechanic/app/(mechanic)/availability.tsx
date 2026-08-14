import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Clock3, Plus, Trash2 } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppInput } from '@/components/app/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuthStore } from '@/stores/auth-store';
import { useTimeSlotStore } from '@/stores/timeslot-store';
import { TimeSlot } from '@/types/models';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { formatDateFull, formatTimeRange, toISODate } from '@/utils/date';
import { getApiErrorMessage } from '@/services/error-messages';
import { ApiError, isApiError } from '@/services/wire-client';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const QUICK_INTERVALS = [
  { label: '+1h', minutes: 60 },
  { label: '+1h30', minutes: 90 },
  { label: '+2h', minutes: 120 },
] as const;
const DEFAULT_BATCH_START_TIME = '08:00';

function compareTime(start: string, end: string) {
  return start.localeCompare(end);
}

function toDateAtMidnight(date: string) {
  return new Date(`${date}T00:00:00`);
}

function maskTimeInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function timeToMinutes(time: string) {
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  return hour * 60 + minute;
}

function minutesToTime(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutesToAdd: number) {
  const result = timeToMinutes(time) + minutesToAdd;
  if (result >= 24 * 60) return null;
  return minutesToTime(result);
}

function validateSlot(date: string, startTime: string, endTime: string) {
  if (!DATE_PATTERN.test(date)) return 'Use data no formato AAAA-MM-DD.';
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return 'Use horario no formato HH:mm.';
  if (compareTime(startTime, endTime) >= 0) return 'Horario final deve ser maior que o inicial.';
  return null;
}

function findLastEndTimeForDate(date: string, slots: TimeSlot[], fallback: string) {
  const sameDate = slots.filter((slot) => slot.date === date);
  if (sameDate.length === 0) return fallback;
  const ordered = [...sameDate].sort((a, b) => compareTime(a.endTime, b.endTime));
  return ordered[ordered.length - 1].endTime;
}

function hasSlotsForDate(date: string, slots: TimeSlot[]) {
  return slots.some((slot) => slot.date === date);
}

function getSlotTestId(slot: TimeSlot) {
  return `availability-slot-${slot.date}-${slot.startTime.replace(':', '')}-${slot.endTime.replace(':', '')}`;
}

function getRequestErrorMessage(error: unknown) {
  const apiError: ApiError | null = isApiError(error) ? error : null;
  return getApiErrorMessage(apiError?.code);
}

function ScreenErrorBanner({ message, testID }: { message: string | null; testID: string }) {
  if (!message) return null;

  return (
    <View style={styles.errorBanner} testID={testID}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function SlotRow({
  slot,
  isDeleting,
  onToggle,
  onDelete,
}: {
  slot: TimeSlot;
  isDeleting: boolean;
  onToggle: (slot: TimeSlot) => void;
  onDelete: (slot: TimeSlot) => void;
}) {
  const hasActiveAppointment = slot.hasActiveAppointment === true;
  const stateLabel = hasActiveAppointment ? 'Reservado' : slot.isAvailable ? 'Disponível' : 'Bloqueado';
  const stateColor = slot.isAvailable && !hasActiveAppointment ? colors.secondary : colors.onSurfaceVariant;
  const deleteDisabled = isDeleting;

  return (
    <View style={styles.slotCard} testID={getSlotTestId(slot)}>
      <View style={styles.slotMain}>
        <Text style={styles.slotDate}>{formatDateFull(slot.date)}</Text>
        <View style={styles.slotTimeRow}>
          <Clock3 size={16} color={colors.onSurfaceVariant} />
          <Text style={styles.slotTime}>{formatTimeRange(slot.startTime, slot.endTime)}</Text>
        </View>
        <Text style={[styles.slotState, { color: stateColor }]}>{stateLabel}</Text>
      </View>
      <View style={styles.slotActions}>
        <Switch
          value={slot.isAvailable}
          onValueChange={() => onToggle(slot)}
          disabled={hasActiveAppointment || isDeleting}
          trackColor={{ false: colors.surfaceContainerHigh, true: colors.secondaryContainer }}
          thumbColor={slot.isAvailable ? colors.secondary : colors.outline}
        />
        <Pressable
          disabled={deleteDisabled}
          onPress={() => onDelete(slot)}
          style={[styles.iconButton, deleteDisabled ? styles.iconButtonDisabled : null]}
          testID="availability-delete-slot-button"
        >
          <Trash2 size={18} color={isDeleting ? colors.onSurfaceVariant : colors.error} />
        </Pressable>
      </View>
    </View>
  );
}

export default function AvailabilityScreen() {
  const user = useAuthStore((state) => state.user);
  const { slots, fetchByMechanic, addSlot, toggleAvailability, removeSlot, isLoading, error } = useTimeSlotStore();
  const today = toISODate(new Date());
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [batchDuration, setBatchDuration] = useState<60 | 90 | 120>(60);
  const [batchCount, setBatchCount] = useState('1');
  const [batchStartTime, setBatchStartTime] = useState(DEFAULT_BATCH_START_TIME);
  const [batchStartDirty, setBatchStartDirty] = useState(false);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [slotPendingDelete, setSlotPendingDelete] = useState<TimeSlot | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'mechanic' && DATE_PATTERN.test(date)) {
      void fetchByMechanic(user.id, date, { force: true });
    }
  }, [date, fetchByMechanic, user]);

  const orderedSlots = useMemo(
    () => [...slots].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
    [slots],
  );

  const refresh = () => {
    if (user?.role === 'mechanic' && DATE_PATTERN.test(date)) {
      void fetchByMechanic(user.id, date, { force: true });
    }
  };

  const resetBatchStart = () => {
    setBatchStartTime(DEFAULT_BATCH_START_TIME);
    setBatchStartDirty(false);
  };

  const handleAdd = async () => {
    if (user?.role !== 'mechanic') return;

    const normalizedStart = maskTimeInput(startTime.trim());
    const normalizedEnd = maskTimeInput(endTime.trim());
    const validation = validateSlot(date.trim(), normalizedStart, normalizedEnd);
    if (validation) {
      setFormError(validation);
      return;
    }

    setSaving(true);
    setFormError(null);
    setActionError(null);
    try {
      await addSlot({
        date: date.trim(),
        startTime: normalizedStart,
        endTime: normalizedEnd,
      });
      setStartTime(normalizedStart);
      setEndTime(normalizedEnd);
    } catch (slotError: unknown) {
      setFormError(getRequestErrorMessage(slotError));
    } finally {
      setSaving(false);
    }
  };

  const handleDurationSuggestion = (durationMinutes: number) => {
    const baseStart = findLastEndTimeForDate(date.trim(), orderedSlots, maskTimeInput(endTime.trim()));
    const nextEnd = addMinutesToTime(baseStart, durationMinutes);

    if (!nextEnd) {
      setFormError('Intervalo passou de 23:59. Ajuste horario base.');
      return;
    }

    setFormError(null);
    setStartTime(baseStart);
    setEndTime(nextEnd);
  };

  const handleBatchAdd = async () => {
    if (user?.role !== 'mechanic') return;
    const count = Number(batchCount);
    if (!Number.isInteger(count) || count <= 0) {
      setFormError('Quantidade de intervalos invalida.');
      return;
    }

    const normalizedBatchStart = maskTimeInput(batchStartTime.trim());
    if (!TIME_PATTERN.test(normalizedBatchStart)) {
      setFormError('Use horario no formato HH:mm.');
      return;
    }

    const batchDate = date.trim();
    const currentDateHasSlots = hasSlotsForDate(batchDate, orderedSlots);
    let currentStart = batchStartDirty || !currentDateHasSlots
      ? normalizedBatchStart
      : findLastEndTimeForDate(batchDate, orderedSlots, normalizedBatchStart);
    const candidates: { date: string; startTime: string; endTime: string }[] = [];

    for (let index = 0; index < count; index++) {
      const nextEnd = addMinutesToTime(currentStart, batchDuration);
      if (!nextEnd) {
        setFormError(`Parou no item ${index + 1}: intervalo passou de 23:59.`);
        return;
      }

      const validation = validateSlot(batchDate, currentStart, nextEnd);
      if (validation) {
        setFormError(`Parou no item ${index + 1}: ${validation}`);
        return;
      }

      candidates.push({ date: batchDate, startTime: currentStart, endTime: nextEnd });
      currentStart = nextEnd;
    }

    setSaving(true);
    setFormError(null);
    setActionError(null);

    try {
      const createdSlots = await addSlot(candidates);

      if (createdSlots.length > 0) {
        const lastSlot = createdSlots[createdSlots.length - 1];
        setStartTime(lastSlot.startTime);
        setEndTime(lastSlot.endTime);
        setBatchStartTime(normalizedBatchStart);
      }
    } catch (slotError: unknown) {
      setFormError(getRequestErrorMessage(slotError));
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setPickerVisible(false);
    }

    if (event.type === 'dismissed' || !selectedDate) return;
    const nextDate = toISODate(selectedDate);
    setDate(nextDate);
    resetBatchStart();
    setFormError(null);
  };

  const handleWebDateChange = (value: string) => {
    const nextDate = value.replace(/[^\d-]/g, '').slice(0, 10);
    setDate(nextDate);
    resetBatchStart();
    setFormError(null);
  };

  const handleToggle = async (slot: TimeSlot) => {
    setActionError(null);
    try {
      await toggleAvailability(slot.id, !slot.isAvailable);
    } catch (toggleError: unknown) {
      const message = getRequestErrorMessage(toggleError);
      setActionError(message);
      Alert.alert('Falha ao atualizar horário', message);
    }
  };

  const handleDelete = (slot: TimeSlot) => {
    setActionError(null);
    setSlotPendingDelete(slot);
  };

  const closeDeleteModal = () => {
    if (deletingSlotId) return;
    setSlotPendingDelete(null);
  };

  const confirmDelete = async () => {
    if (!slotPendingDelete || user?.role !== 'mechanic') return;

    setDeletingSlotId(slotPendingDelete.id);
    setActionError(null);
    try {
      await removeSlot(slotPendingDelete.id);
      setSlotPendingDelete(null);
    } catch (deleteError: unknown) {
      const message = getRequestErrorMessage(deleteError);
      setActionError(message);
      Alert.alert('Falha ao excluir', message);
    } finally {
      setDeletingSlotId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Disponibilidade</Text>
        <Text style={styles.title}>Gerenciar horarios</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formCard}>
          <View style={styles.formTitleRow}>
            <Plus size={20} color={colors.safetyOrange} />
            <Text style={styles.formTitle}>Adicionar disponibilidade</Text>
          </View>

          {Platform.OS === 'web' ? (
            <AppInput
              label="Data"
              testID="availability-date-input-web"
              value={date}
              onChangeText={handleWebDateChange}
              placeholder="AAAA-MM-DD"
              autoCapitalize="none"
              {...({ type: 'date', min: today } as any)}
            />
          ) : (
            <Pressable testID="availability-date-trigger" onPress={() => setPickerVisible((v) => !v)} style={styles.dateButton}>
              <Text style={styles.dateButtonLabel}>Data</Text>
              <Text style={styles.dateButtonValue}>{formatDateFull(date)}</Text>
              <Text style={styles.dateButtonHint}>{date}</Text>
            </Pressable>
          )}

          {Platform.OS !== 'web' && pickerVisible ? (
            <DateTimePicker
              testID="availability-date-picker"
              mode="date"
              value={toDateAtMidnight(date)}
              minimumDate={toDateAtMidnight(today)}
              onChange={handleDateChange}
            />
          ) : null}

          <View style={styles.modeSwitcher}>
            <Pressable
              onPress={() => setMode('single')}
              style={[styles.modeButton, mode === 'single' ? styles.modeButtonActive : null]}
            >
              <Text style={[styles.modeButtonText, mode === 'single' ? styles.modeButtonTextActive : null]}>Horario individual</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('batch')}
              style={[styles.modeButton, mode === 'batch' ? styles.modeButtonActive : null]}
            >
              <Text style={[styles.modeButtonText, mode === 'batch' ? styles.modeButtonTextActive : null]}>Adicionar em lote</Text>
            </Pressable>
          </View>

          <Text style={styles.hintTitle}>Sugestoes de duracao</Text>
          <View style={styles.quickRow}>
            {QUICK_INTERVALS.map((interval) => (
              <Pressable
                key={interval.label}
                style={styles.quickChip}
                onPress={() => handleDurationSuggestion(interval.minutes)}
                disabled={saving}
                testID={`availability-quick-${interval.minutes}`}
              >
                <Text style={styles.quickChipText}>{interval.label}</Text>
              </Pressable>
            ))}
          </View>

          {mode === 'single' ? (
            <View style={styles.timeInputs}>
              <AppInput
                label="Inicio"
                value={startTime}
                onChangeText={(value) => setStartTime(maskTimeInput(value))}
                placeholder="08:00"
                autoCapitalize="none"
                keyboardType="number-pad"
                maxLength={5}
                testID="availability-start-input"
              />
              <AppInput
                label="Fim"
                value={endTime}
                onChangeText={(value) => setEndTime(maskTimeInput(value))}
                placeholder="09:00"
                autoCapitalize="none"
                keyboardType="number-pad"
                maxLength={5}
                testID="availability-end-input"
              />
            </View>
          ) : (
            <View style={styles.batchCard}>
              <Text style={styles.batchTitle}>Configuracao de lote</Text>
              <View style={styles.batchDurationRow}>
                {[60, 90, 120].map((minutes) => (
                  <Pressable
                    key={minutes}
                    testID={`availability-duration-${minutes}`}
                    onPress={() => setBatchDuration(minutes as 60 | 90 | 120)}
                    style={[styles.durationChip, batchDuration === minutes ? styles.durationChipActive : null]}
                  >
                    <Text style={[styles.durationChipText, batchDuration === minutes ? styles.durationChipTextActive : null]}>
                      {minutes === 90 ? '1h30' : `${minutes / 60}h`}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <AppInput
                label="Inicio do lote"
                value={batchStartTime}
                onChangeText={(value) => {
                  setBatchStartTime(maskTimeInput(value));
                  setBatchStartDirty(true);
                }}
                placeholder="08:00"
                autoCapitalize="none"
                keyboardType="number-pad"
                maxLength={5}
                testID="availability-batch-start-input"
              />
              <AppInput
                label="Quantidade de slots"
                value={batchCount}
                onChangeText={(value) => setBatchCount(value.replace(/\D/g, '').slice(0, 2))}
                placeholder="3"
                keyboardType="number-pad"
                autoCapitalize="none"
                testID="availability-batch-count-input"
              />
              <PrimaryButton
                title="Criar lote"
                testID="availability-create-batch-button"
                onPress={handleBatchAdd}
                loading={saving}
                disabled={saving}
                variant="outlined"
              />
            </View>
          )}

          <ScreenErrorBanner message={formError} testID="availability-form-error-banner" />

          <PrimaryButton
            title="Criar horarios"
            testID="availability-create-slot-button"
            onPress={handleAdd}
            loading={saving}
            disabled={saving}
            variant="filled"
          />
        </View>

        <ScreenErrorBanner message={actionError} testID="availability-action-error-banner" />
        <ScreenErrorBanner message={error} testID="availability-load-error-banner" />

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Horarios atuais</Text>
          <Text style={styles.count}>{orderedSlots.length} slots em {formatDateFull(date)}</Text>
        </View>

        {orderedSlots.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhum horario ainda</Text>
            <Text style={styles.emptyText}>Crie horarios para clientes reservarem periodos disponiveis.</Text>
          </View>
        ) : (
          orderedSlots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              isDeleting={deletingSlotId === slot.id}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!slotPendingDelete}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Excluir horario?</Text>
            {slotPendingDelete ? (
              <Text style={styles.confirmText}>
                {formatDateFull(slotPendingDelete.date)} - {formatTimeRange(slotPendingDelete.startTime, slotPendingDelete.endTime)}
              </Text>
            ) : null}
            <ScreenErrorBanner message={actionError} testID="availability-delete-error-banner" />
            <View style={styles.confirmActions}>
              <Pressable
                disabled={!!deletingSlotId}
                onPress={closeDeleteModal}
                style={[styles.confirmButton, styles.cancelButton, deletingSlotId ? styles.confirmButtonDisabled : null]}
                testID="availability-delete-cancel-button"
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={!!deletingSlotId}
                onPress={() => {
                  void confirmDelete();
                }}
                style={[styles.confirmButton, styles.deleteButton, deletingSlotId ? styles.confirmButtonDisabled : null]}
                testID="availability-delete-confirm-button"
              >
                <Text style={styles.deleteButtonText}>{deletingSlotId ? 'Excluindo...' : 'Excluir'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
  formCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    gap: spacing.base,
    ...shadow.light,
  },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  formTitle: { ...typography.headlineMd, color: colors.onSurface },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.lg,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  modeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  modeButtonText: { ...typography.labelMd, color: colors.onSurfaceVariant },
  modeButtonTextActive: { color: colors.onSurface },
  hintTitle: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  timeInputs: { flexDirection: 'row', gap: spacing.sm },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    gap: 2,
  },
  dateButtonLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  dateButtonValue: { ...typography.bodyMd, color: colors.onSurface },
  dateButtonHint: { ...typography.labelSm, color: colors.onSurfaceVariant },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  quickChipText: { ...typography.labelSm, color: colors.onSurface },
  batchCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  batchTitle: { ...typography.labelMd, color: colors.onSurface },
  batchDurationRow: { flexDirection: 'row', gap: spacing.sm },
  durationChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceContainerHigh,
  },
  durationChipActive: {
    borderColor: colors.safetyOrange,
    backgroundColor: colors.secondaryContainer,
  },
  durationChipText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  durationChipTextActive: { color: colors.safetyOrange },
  errorText: { ...typography.labelSm, color: colors.error },
  errorBanner: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    backgroundColor: colors.errorContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { ...typography.headlineMd, color: colors.onSurface },
  count: { ...typography.labelMd, color: colors.onSurfaceVariant },
  slotCard: {
    minHeight: 112,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.base,
    ...shadow.light,
  },
  slotMain: { flex: 1, gap: spacing.base },
  slotDate: { ...typography.headlineMd, color: colors.onSurface },
  slotTimeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  slotTime: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  slotState: { ...typography.labelSm },
  slotActions: { alignItems: 'center', justifyContent: 'space-between' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorContainer,
  },
  iconButtonDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
    opacity: 0.7,
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmDialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.lg,
    gap: spacing.base,
    ...shadow.light,
  },
  confirmTitle: { ...typography.headlineMd, color: colors.onSurface },
  confirmText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  confirmButton: {
    minWidth: 108,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  confirmButtonDisabled: { opacity: 0.7 },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  deleteButton: { backgroundColor: colors.error },
  cancelButtonText: { ...typography.labelMd, color: colors.onSurface },
  deleteButtonText: { ...typography.labelMd, color: colors.onPrimary },
});
