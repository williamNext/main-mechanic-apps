import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateChip } from '@/components/ui/DateChip';
import { InputField } from '@/components/ui/InputField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TimeSlotButton } from '@/components/ui/TimeSlotButton';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { colors, radius, shadow, spacing, typography } from '@main-mechanic/theme';
import { useAuth } from '@/hooks/use-auth';
import { useAppointmentStore } from '@/stores/appointment-store';
import { useMechanicStore } from '@/stores/mechanic-store';
import { useTimeSlotStore } from '@/stores/timeslot-store';
import { getApiErrorMessage, isApiError } from '@main-mechanic/wire-client';
import { PublicMechanic, TimeSlot } from '@main-mechanic/types';
import { getNextDays } from '@/utils/date';
import { getInitials } from '@/utils/format';

export default function BookMechanicScreen() {
  const { mechanicId } = useLocalSearchParams<{ mechanicId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { getById } = useMechanicStore();
  const { slots, fetchAvailable } = useTimeSlotStore();
  const { book } = useAppointmentStore();

  const [mechanic, setMechanic] = useState<PublicMechanic | null>(null);
  const [mechanicError, setMechanicError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getNextDays(1)[0]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [vehicleModel, setVehicleModel] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const days = useMemo(() => getNextDays(7), []);

  useEffect(() => {
    if (mechanicId) {
      setMechanic(null);
      setMechanicError(null);
      getById(mechanicId)
        .then((mechanicData) => {
          if (mechanicData) {
            setMechanic(mechanicData);
          } else {
            setMechanicError(getApiErrorMessage('MECHANIC_NOT_FOUND'));
          }
        })
        .catch((error: unknown) => {
          setMechanicError(getApiErrorMessage(isApiError(error) ? error.code : null));
        });
    }
  }, [mechanicId, getById]);

  useEffect(() => {
    if (mechanicId) {
      fetchAvailable(mechanicId, selectedDate);
      setSelectedSlot(null);
    }
  }, [mechanicId, selectedDate, fetchAvailable]);

  async function handleBook() {
    if (!selectedSlot || !user || !mechanic) {
      return;
    }

    setBookingError(null);
    setBooking(true);
    try {
      const appointment = await book({
        timeSlotId: selectedSlot.id,
        vehicleInfo: vehicleModel.trim(),
        notes: problemDescription.trim(),
      });
      router.replace({ pathname: '/(client)/booking-success', params: { id: appointment.id } });
    } catch (error: unknown) {
      const code = isApiError(error) ? error.code : null;

      if (code === 'TIMESLOT_UNAVAILABLE' || code === 'TIMESLOT_EXPIRED') {
        Alert.alert('Erro', getApiErrorMessage(code));
        setBookingError(getApiErrorMessage(code));
        await fetchAvailable(mechanicId, selectedDate, { force: true });
        setSelectedSlot(null);
      } else if (code === 'VALIDATION_FAILED') {
        Alert.alert('Erro', getApiErrorMessage(code));
        setBookingError(getApiErrorMessage(code));
      } else {
        Alert.alert('Erro', getApiErrorMessage(code));
        setBookingError(getApiErrorMessage(code));
      }
    } finally {
      setBooking(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopAppBar showBackButton title="Agendar" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {mechanicError ? (
            <View testID="mechanic-error" style={styles.mechanicError}>
              <MaterialIcons name="error-outline" size={20} color={colors.error} />
              <Text style={styles.mechanicErrorText}>{mechanicError}</Text>
            </View>
          ) : !mechanic ? (
            <View style={styles.skeletonProfile} />
          ) : (
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(mechanic.name)}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{mechanic.name}</Text>
                <Text style={styles.profileSpecialty}>{mechanic.specialty}</Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selecione a Data</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
              {days.map((day, index) => (
                <DateChip
                  key={day}
                  testID={`date-chip-${index}`}
                  dayLabel={format(parseISO(day), 'EEE', { locale: ptBR })}
                  dayNumber={format(parseISO(day), 'dd')}
                  active={selectedDate === day}
                  onPress={() => setSelectedDate(day)}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Horários Disponíveis</Text>
            <View style={styles.slotGrid}>
              {slots.length > 0 ? (
                slots.map((slot) => (
                  <View key={slot.id} style={styles.slotCell}>
                    <TimeSlotButton
                      testID={`slot-button-${slot.id}`}
                      label={slot.startTime.slice(0, 5)}
                      selected={selectedSlot?.id === slot.id}
                      onPress={() => setSelectedSlot(slot)}
                    />
                  </View>
                ))
              ) : (
                <View style={styles.noSlots}>
                  <MaterialIcons name="schedule" size={20} color={colors.outline} />
                  <Text style={styles.noSlotsText}>Nenhum horário disponível para este dia.</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <InputField
              testID="vehicle-model-input"
              label="Modelo do Veículo"
              value={vehicleModel}
              onChangeText={setVehicleModel}
              placeholder="Ex: Toyota Corolla 2020"
              leftIcon={<MaterialIcons name="directions-car" size={18} color={colors.outline} />}
            />
            <View style={styles.spacer} />
            <InputField
              testID="problem-description-input"
              label="Descrição do Problema"
              value={problemDescription}
              onChangeText={setProblemDescription}
              placeholder="Descreva o problema"
              multiline
              numberOfLines={3}
              leftIcon={<MaterialIcons name="build" size={18} color={colors.outline} />}
            />
          </View>
          <View style={styles.contentBottomSpace} />
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.fixedCtaWrap}>
          {bookingError ? (
            <View style={styles.mechanicError}>
              <MaterialIcons name="error-outline" size={20} color={colors.error} />
              <Text testID="booking-error" style={styles.mechanicErrorText}>
                {bookingError}
              </Text>
            </View>
          ) : null}
          <PrimaryButton
            testID="confirm-booking-button"
            title="Confirmar Agendamento"
            variant="secondary"
            leftIcon={<MaterialIcons name="event-available" size={18} color={colors.onPrimary} />}
            onPress={handleBook}
            loading={booking}
            disabled={!selectedSlot || !vehicleModel.trim() || !problemDescription.trim()}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.gutterMobile,
    paddingTop: spacing.sm,
  },
  skeletonProfile: {
    height: 110,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainer,
    marginBottom: spacing.md,
  },
  mechanicError: {
    borderRadius: radius.md,
    backgroundColor: colors.errorContainer,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  mechanicErrorText: {
    ...typography.bodyMd,
    color: colors.error,
    flex: 1,
  },
  profileCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    ...shadow.medium,
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
  profileInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  profileName: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  profileSpecialty: {
    ...typography.labelSm,
    color: colors.outline,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.headlineMd,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  dateRow: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  slotCell: {
    width: '33.3333%',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  noSlots: {
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  noSlotsText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  spacer: {
    height: spacing.sm,
  },
  fixedCtaWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.gutterMobile,
    paddingTop: spacing.sm,
  },
  contentBottomSpace: {
    height: spacing.xl,
  },
});
