import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Clock3, Lock, Plus, Trash2 } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppInput } from '@/components/app/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuthStore } from '@/stores/auth-store';
import { useTimeSlotStore } from '@/stores/timeslot-store';
import { TimeSlot } from '@/types/models';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { formatDateFull, formatTimeRange, toISODate } from '@/utils/date';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const QUICK_INTERVALS = [
  { label: '+1h', minutes: 60 },
  { label: '+1h30', minutes: 90 },
  { label: '+2h', minutes: 120 },
] as const;

function compareTime(start: string, end: string) {
  return start.localeCompare(end);
}

function toDateAtMidnight(date: string) {
  return new Date(`${date}T00:00:00`);
}

function isPastDate(date: string) {
  if (!DATE_PATTERN.test(date)) return true;
  const today = toISODate(new Date());
  return date < today;
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

function hasOverlap(slots: TimeSlot[], date: string, startTime: string, endTime: string) {
  return slots.some((slot) => {
    if (slot.date !== date) return false;
    return compareTime(startTime, slot.endTime) < 0 && compareTime(endTime, slot.startTime) > 0;
  });
}

function validateSlot(date: string, startTime: string, endTime: string, slots: TimeSlot[]) {
  if (!DATE_PATTERN.test(date)) return 'Use data no formato AAAA-MM-DD.';
  if (isPastDate(date)) return 'Nao pode usar data no passado.';
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return 'Use horario no formato HH:mm.';
  if (compareTime(startTime, endTime) >= 0) return 'Horario final deve ser maior que o inicial.';
  if (hasOverlap(slots, date, startTime, endTime)) return 'Horario conflita com outro existente.';
  return null;
}

function findLastEndTimeForDate(date: string, slots: TimeSlot[], fallback: string) {
  const sameDate = slots.filter((slot) => slot.date === date);
  if (sameDate.length === 0) return fallback;
  const ordered = [...sameDate].sort((a, b) => compareTime(a.endTime, b.endTime));
  return ordered[ordered.length - 1].endTime;
}

function SlotRow({
  slot,
  onToggle,
  onDelete,
}: {
  slot: TimeSlot;
  onToggle: (slot: TimeSlot) => void;
  onDelete: (slot: TimeSlot) => void;
}) {
  return (
    <View style={styles.slotCard}>
      <View style={styles.slotMain}>
        <Text style={styles.slotDate}>{formatDateFull(slot.date)}</Text>
        <View style={styles.slotTimeRow}>
          <Clock3 size={16} color={colors.onSurfaceVariant} />
          <Text style={styles.slotTime}>{formatTimeRange(slot.startTime, slot.endTime)}</Text>
        </View>
        <Text style={[styles.slotState, { color: slot.isAvailable ? colors.secondary : colors.onSurfaceVariant }]}>
          {slot.isAvailable ? 'Disponivel' : 'Bloqueado ou reservado'}
        </Text>
      </View>
      <View style={styles.slotActions}>
        <Switch
          value={slot.isAvailable}
          onValueChange={() => onToggle(slot)}
          trackColor={{ false: colors.surfaceContainerHigh, true: colors.secondaryContainer }}
          thumbColor={slot.isAvailable ? colors.secondary : colors.outline}
        />
        <Pressable
          disabled={!slot.isAvailable}
          onPress={() => onDelete(slot)}
          style={[styles.iconButton, !slot.isAvailable ? styles.iconButtonDisabled : null]}
        >
          {slot.isAvailable ? <Trash2 size={18} color={colors.error} /> : <Lock size={18} color={colors.onSurfaceVariant} />}
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
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [batchDuration, setBatchDuration] = useState<60 | 90 | 120>(60);
  const [batchCount, setBatchCount] = useState('1');
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  useEffect(() => {
    if (user?.role === 'mechanic') {
      void fetchByMechanic(user.id, { force: true });
    }
  }, [fetchByMechanic, user]);

  const orderedSlots = useMemo(
    () => [...slots].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
    [slots],
  );

  const todaySlotsCount = useMemo(
    () => orderedSlots.filter((slot) => slot.date === today).length,
    [orderedSlots, today],
  );

  const refresh = () => {
    if (user?.role === 'mechanic') {
      void fetchByMechanic(user.id, { force: true });
    }
  };

  const handleAdd = async () => {
    if (user?.role !== 'mechanic') return;

    const normalizedStart = maskTimeInput(startTime.trim());
    const normalizedEnd = maskTimeInput(endTime.trim());
    const validation = validateSlot(date.trim(), normalizedStart, normalizedEnd, orderedSlots);
    if (validation) {
      setFormError(validation);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await addSlot({
        mechanicId: user.id,
        date: date.trim(),
        startTime: normalizedStart,
        endTime: normalizedEnd,
        isAvailable: true,
      });
      setStartTime(normalizedStart);
      setEndTime(normalizedEnd);
    } catch (slotError: any) {
      setFormError(slotError.message || 'Falha ao criar horario.');
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

    let currentStart = findLastEndTimeForDate(date.trim(), orderedSlots, maskTimeInput(endTime.trim()));
    const stagedSlots: TimeSlot[] = [];
    setSaving(true);
    setFormError(null);

    try {
      for (let index = 0; index < count; index++) {
        const nextEnd = addMinutesToTime(currentStart, batchDuration);
        if (!nextEnd) {
          throw new Error(`Parou no item ${index + 1}: intervalo passou de 23:59.`);
        }

        const combined = [...orderedSlots, ...stagedSlots];
        const validation = validateSlot(date.trim(), currentStart, nextEnd, combined);
        if (validation) {
          throw new Error(`Parou no item ${index + 1}: ${validation}`);
        }

        const created = await addSlot({
          mechanicId: user.id,
          date: date.trim(),
          startTime: currentStart,
          endTime: nextEnd,
          isAvailable: true,
        });
        stagedSlots.push(created);
        currentStart = nextEnd;
      }

      if (stagedSlots.length > 0) {
        const lastSlot = stagedSlots[stagedSlots.length - 1];
        setStartTime(lastSlot.startTime);
        setEndTime(lastSlot.endTime);
      }
    } catch (slotError: any) {
      setFormError(slotError.message || 'Falha ao criar intervalos em lote.');
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
    if (isPastDate(nextDate)) {
      setFormError('Nao pode usar data no passado.');
      return;
    }
    setDate(nextDate);
    setFormError(null);
  };

  const handleWebDateChange = (value: string) => {
    const nextDate = value.replace(/[^\d-]/g, '').slice(0, 10);
    setDate(nextDate);
    if (DATE_PATTERN.test(nextDate) && isPastDate(nextDate)) {
      setFormError('Nao pode usar data no passado.');
      return;
    }
    setFormError(null);
  };

  const handleToggle = async (slot: TimeSlot) => {
    try {
      await toggleAvailability(slot.id, !slot.isAvailable);
    } catch (toggleError: any) {
      Alert.alert('Falha ao atualizar horario', toggleError.message || 'Tente novamente.');
    }
  };

  const handleDelete = (slot: TimeSlot) => {
    if (!slot.isAvailable) return;

    Alert.alert('Excluir horario?', `${formatDateFull(slot.date)} - ${formatTimeRange(slot.startTime, slot.endTime)}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void removeSlot(slot.id).catch((deleteError: any) => {
            Alert.alert('Falha ao excluir', deleteError.message || 'Tente novamente.');
          });
        },
      },
    ]);
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

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <PrimaryButton
            title="Criar horarios"
            testID="availability-create-slot-button"
            onPress={handleAdd}
            loading={saving}
            disabled={saving}
            variant="filled"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Horarios atuais</Text>
          <Text style={styles.count}>{todaySlotsCount} slots hoje</Text>
        </View>

        {orderedSlots.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhum horario ainda</Text>
            <Text style={styles.emptyText}>Crie horarios para clientes reservarem periodos disponiveis.</Text>
          </View>
        ) : (
          orderedSlots.map((slot) => <SlotRow key={slot.id} slot={slot} onToggle={handleToggle} onDelete={handleDelete} />)
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
});
