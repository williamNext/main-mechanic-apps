import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TimeSlotPicker } from '@/components/TimeSlotPicker';
import { useAuth } from '@/hooks/use-auth';
import { useMechanicStore } from '@/stores/mechanic-store';
import { useTimeSlotStore } from '@/stores/timeslot-store';
import { useAppointmentStore } from '@/stores/appointment-store';
import { Mechanic, TimeSlot } from '@/types/models';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import { getNextDays, formatDate } from '@/utils/date';

export default function BookMechanicScreen() {
  const { mechanicId } = useLocalSearchParams<{ mechanicId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { getById } = useMechanicStore();
  const { slots, fetchAvailable } = useTimeSlotStore();
  const { book } = useAppointmentStore();

  const [mechanic, setMechanic] = useState<Mechanic | null>(null);
  const [selectedDate, setSelectedDate] = useState(getNextDays(1)[0]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [booking, setBooking] = useState(false);
  const days = getNextDays(7);

  useEffect(() => {
    if (mechanicId) {
      getById(mechanicId).then((m) => setMechanic(m));
    }
  }, [mechanicId]);

  useEffect(() => {
    if (mechanicId) {
      fetchAvailable(mechanicId, selectedDate);
      setSelectedSlot(null);
    }
  }, [mechanicId, selectedDate]);

  async function handleBook() {
    if (!selectedSlot || !user || !mechanic) return;
    setBooking(true);
    try {
      await book({
        clientId: user.id,
        clientName: user.name,
        mechanicId: mechanic.id,
        mechanicName: mechanic.name,
        timeSlotId: selectedSlot.id,
        date: selectedSlot.date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        vehicleInfo: vehicleInfo.trim() || undefined,
      });
      Alert.alert('Agendado!', 'Seu agendamento foi realizado com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Falha ao realizar agendamento');
    } finally {
      setBooking(false);
    }
  }

  if (!mechanic) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Mechanic header */}
      <View style={styles.profileHeader}>
        <Avatar name={mechanic.name} imageUrl={mechanic.avatarUrl} size="lg" />
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{mechanic.name}</Text>
          <Badge label={mechanic.specialty} />
          {mechanic.rating != null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={Colors.warning} />
              <Text style={styles.ratingText}>{mechanic.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Date selector — ScrollView with fixed-width chips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Escolha o dia</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateBar}
        >
          {days.map((item) => {
            const isActive = item === selectedDate;
            const dayNum = item.split('-')[2];
            return (
              <TouchableOpacity
                key={item}
                onPress={() => setSelectedDate(item)}
                activeOpacity={0.7}
                style={[styles.dateChip, isActive && styles.dateChipActive]}
              >
                <Text style={[styles.dateWeekday, isActive && styles.dateWeekdayActive]}>
                  {formatDate(item)}
                </Text>
                <Text style={[styles.dateNum, isActive && styles.dateNumActive]}>
                  {dayNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Time slot picker */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Horários disponíveis</Text>
        <TimeSlotPicker
          slots={slots}
          selectedSlotId={selectedSlot?.id}
          onSelect={setSelectedSlot}
        />
      </View>

      {/* Vehicle info */}
      <View style={styles.section}>
        <Input
          label="Informações do veículo (opcional)"
          value={vehicleInfo}
          onChangeText={setVehicleInfo}
          placeholder="Ex: Honda Civic 2020 — Barulho no motor"
          multiline
          icon={<Ionicons name="car-outline" size={18} color={Colors.gray400} />}
        />
      </View>

      {/* Book button */}
      <View style={styles.section}>
        <Button
          title="Confirmar Agendamento"
          onPress={handleBook}
          disabled={!selectedSlot}
          loading={booking}
          size="lg"
          icon={<Ionicons name="checkmark-circle" size={20} color={Colors.white} />}
        />
      </View>

      <View style={{ height: Spacing.xxxl * 2 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.gray500,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.gray900,
    marginBottom: Spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  ratingText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.gray600,
    marginLeft: 4,
  },
  section: {
    paddingHorizontal: Spacing.xxl,
    marginTop: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.gray900,
    marginBottom: Spacing.md,
  },
  dateBar: {
    paddingRight: Spacing.lg,
  },
  dateChip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 72,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    ...Shadow.sm,
  },
  dateChipActive: {
    backgroundColor: Colors.accent,
  },
  dateWeekday: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    fontWeight: FontWeight.medium,
    marginBottom: 2,
  },
  dateWeekdayActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  dateNum: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.gray900,
  },
  dateNumActive: {
    color: Colors.white,
  },
});
