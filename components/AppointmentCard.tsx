import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Appointment } from '@/types/models';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { formatDate, formatTimeRange } from '@/utils/date';

interface AppointmentCardProps {
  appointment: Appointment;
  showMechanic?: boolean;
  showClient?: boolean;
  onPress?: () => void;
}

export function AppointmentCard({
  appointment,
  showMechanic = false,
  showClient = false,
  onPress,
}: AppointmentCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
            <Text style={styles.date}>{formatDate(appointment.date)}</Text>
          </View>
          <StatusBadge status={appointment.status} />
        </View>

        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={16} color={Colors.gray500} />
          <Text style={styles.time}>
            {formatTimeRange(appointment.startTime, appointment.endTime)}
          </Text>
        </View>

        {showMechanic && appointment.mechanicName && (
          <View style={styles.infoRow}>
            <Ionicons name="construct-outline" size={16} color={Colors.gray500} />
            <Text style={styles.infoText}>{appointment.mechanicName}</Text>
          </View>
        )}

        {showClient && appointment.clientName && (
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color={Colors.gray500} />
            <Text style={styles.infoText}>{appointment.clientName}</Text>
          </View>
        )}

        {appointment.vehicleInfo && (
          <View style={styles.vehicleRow}>
            <Ionicons name="car-outline" size={16} color={Colors.gray400} />
            <Text style={styles.vehicleText}>{appointment.vehicleInfo}</Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  date: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.gray900,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  time: {
    fontSize: FontSize.md,
    color: Colors.gray700,
    fontWeight: FontWeight.medium,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: Colors.gray600,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  vehicleText: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    flex: 1,
  },
});
