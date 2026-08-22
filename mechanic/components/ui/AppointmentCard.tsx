import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Appointment } from '@/types/models';
import { colors, radius, shadow, spacing, statusTheme, StatusLabels, typography } from '@main-mechanic/theme';
import { formatDate, formatTimeRange } from '@/utils/date';
import { getInitials } from '@/utils/format';

interface AppointmentCardProps {
  appointment: Appointment;
  onPress?: () => void;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function AppointmentCard({
  appointment,
  onPress,
  actionLabel = 'Ver detalhes',
  onActionPress,
}: AppointmentCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const theme = (statusTheme as Record<string, (typeof statusTheme)[keyof typeof statusTheme]>)[appointment.status] || statusTheme.confirmado;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 0,
    }).start();
  };

  const initials = getInitials(appointment.mechanicName || appointment.clientName || 'MP');

  return (
    <Animated.View style={[styles.outer, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{ color: colors.surfaceContainerHigh }}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={[styles.statusStrip, { backgroundColor: theme.background }]}> 
          <MaterialIcons name={theme.icon as keyof typeof MaterialIcons.glyphMap} size={18} color={theme.text} />
          <Text style={[styles.statusText, { color: theme.text }]}>{StatusLabels[appointment.status] || appointment.status}</Text>
        </View>

        <View style={styles.bodyRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={styles.mainInfo}>
            <Text numberOfLines={1} style={styles.name}>{appointment.mechanicName || 'Mecânico'}</Text>
            <Text style={styles.specialtyText}>{appointment.vehicleInfo || 'Diagnóstico e manutenção'}</Text>
          </View>

          <View style={styles.dateColumn}>
            <Text style={styles.dateText}>{formatDate(appointment.date)}</Text>
            <Text style={styles.timeText}>{formatTimeRange(appointment.startTime, appointment.endTime)}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Veículo</Text>
            <Text numberOfLines={2} style={styles.infoValue}>{appointment.vehicleInfo || 'Não informado'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Serviço</Text>
            <Text numberOfLines={2} style={styles.infoValue}>{appointment.notes || 'Sem descrição'}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerStatus}>{StatusLabels[appointment.status] || appointment.status}</Text>
          <Pressable
            onPress={onActionPress || onPress}
            android_ripple={{ color: colors.surfaceContainerHigh }}
            style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
          >
            <Text style={styles.footerButtonText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
    ...shadow.light,
  },
  pressed: {
    opacity: 0.9,
  },
  statusStrip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.base,
  },
  statusText: {
    ...typography.labelMd,
  },
  bodyRow: {
    flexDirection: 'row',
    padding: spacing.sm,
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
  mainInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  specialtyText: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  dateColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 90,
  },
  dateText: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: 'right',
  },
  timeText: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    textAlign: 'right',
  },
  infoGrid: {
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  infoCell: {
    flex: 1,
    gap: spacing.xs,
  },
  infoLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  infoValue: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  footer: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerStatus: {
    ...typography.labelMd,
    color: colors.primary,
  },
  footerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
  },
  footerButtonText: {
    ...typography.labelSm,
    color: colors.onSurface,
  },
});
