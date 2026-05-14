import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAppointmentStore } from '@/stores/appointment-store';
import { formatDate } from '@/utils/date';
import { getInitials, toBrazilWhatsAppPhone } from '@/utils/format';

export default function BookingSuccessScreen() {
  const router = useRouter();
  const { appointments } = useAppointmentStore();
  const scale = useRef(new Animated.Value(0.85)).current;

  const latestAppointment = useMemo(
    () => appointments[appointments.length - 1],
    [appointments],
  );

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 12,
    }).start();
  }, [scale]);

  const handleWhatsApp = () => {
    if (!latestAppointment?.mechanicPhone) {
      return;
    }
    const phone = toBrazilWhatsAppPhone(latestAppointment.mechanicPhone);
    if (!phone) {
      return;
    }
    const message = `Olá ${latestAppointment.mechanicName || 'mecânico'}, confirmando meu agendamento.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`).catch(() => null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Animated.View style={[styles.successIconWrap, { transform: [{ scale }] }]}> 
          <MaterialIcons name="check-circle" size={48} color={colors.onPrimary} />
        </Animated.View>

        <Text style={styles.title}>Agendamento Confirmado!</Text>
        <Text style={styles.subtitle}>Seu veículo está em boas mãos.</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(latestAppointment?.mechanicName || 'Mecânico')}</Text>
            </View>
            <View style={styles.summaryNameWrap}>
              <Text style={styles.mechanicName}>{latestAppointment?.mechanicName || 'Mecânico'}</Text>
              <View style={styles.ratingRow}>
                <MaterialIcons name="star" size={15} color={colors.secondary} />
                <Text style={styles.ratingText}>4.8 avaliação</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Data e Hora</Text>
              <Text style={styles.summaryValue}>
                {latestAppointment ? `${formatDate(latestAppointment.date)} ${latestAppointment.startTime}` : 'A confirmar'}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Serviço</Text>
              <Text style={styles.summaryValue}>{latestAppointment?.vehicleInfo || 'Diagnóstico geral'}</Text>
            </View>
          </View>

          <View style={styles.notesRow}>
            <Text style={styles.summaryLabel}>Observações</Text>
            <Text style={styles.summaryValue}>{latestAppointment?.notes || 'Sem observações adicionais.'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {latestAppointment?.mechanicPhone ? (
          <PrimaryButton
            title="Falar com Mecânico"
            variant="whatsapp"
            leftIcon={<MaterialIcons name="chat" size={18} color={colors.onPrimary} />}
            onPress={handleWhatsApp}
          />
        ) : null}

        <PrimaryButton
          title="Ir para Meus Agendamentos"
          variant="secondary"
          onPress={() => router.replace('/(client)/bookings')}
        />

        <Text style={styles.linkText}>Precisa cancelar ou reagendar?</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.gutterMobile,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.coral,
  },
  title: {
    ...typography.headlineLgMobile,
    color: colors.onSurface,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.xs,
  },
  summaryCard: {
    marginTop: spacing.md,
    width: '100%',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.sm,
    ...shadow.light,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  summaryNameWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  mechanicName: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingText: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  divider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginVertical: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCell: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  summaryValue: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  notesRow: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  linkText: {
    ...typography.labelSm,
    color: colors.outline,
    textAlign: 'center',
  },
});
