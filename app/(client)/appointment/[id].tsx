import React, { useMemo } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAppointmentStore } from '@/stores/appointment-store';
import { formatDate, formatTimeRange } from '@/utils/date';
import { formatPhone, getInitials, toBrazilWhatsAppPhone } from '@/utils/format';

export default function AppointmentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { appointments, updateStatus } = useAppointmentStore();

  const appointment = useMemo(
    () => appointments.find((item) => item.id === id),
    [appointments, id],
  );

  const handleWhatsApp = () => {
    if (!appointment?.mechanicPhone) {
      Alert.alert('Contato indisponível', 'Número de telefone do mecânico não disponível.');
      return;
    }

    const whatsappPhone = toBrazilWhatsAppPhone(appointment.mechanicPhone);
    if (!whatsappPhone) {
      Alert.alert('Contato inválido', 'Não foi possível abrir o WhatsApp com esse número.');
      return;
    }

    const message = `Olá ${appointment.mechanicName || 'mecânico'}, sobre o meu agendamento do dia ${formatDate(appointment.date)} às ${appointment.startTime}...`;
    Linking.openURL(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const handleCancel = () => {
    if (!appointment) {
      return;
    }

    Alert.alert('Cancelar agendamento', 'Deseja realmente cancelar este agendamento?', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar',
        style: 'destructive',
        onPress: () => {
          updateStatus(appointment.id, 'cancelled').catch(() => {
            Alert.alert('Erro', 'Não foi possível cancelar o agendamento.');
          });
        },
      },
    ]);
  };

  if (!appointment) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TopAppBar title="Detalhes" showBackButton />
        <View style={styles.notFoundWrap}>
          <Text style={styles.notFoundText}>Agendamento não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopAppBar title="Detalhes" showBackButton />
      <StatusBanner status={appointment.status} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.detailCard}>
          <View style={styles.mechanicRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(appointment.mechanicName || 'Mecânico')}</Text>
            </View>
            <View style={styles.mechanicInfo}>
              <Text style={styles.mechanicName}>{appointment.mechanicName || 'Mecânico'}</Text>
              <View style={styles.ratingRow}>
                <MaterialIcons name="star" size={15} color={colors.secondary} />
                <Text style={styles.ratingText}>4.8 avaliação</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.grid}>
            <DetailTile icon="calendar-today" title="Data e Hora" value={`${formatDate(appointment.date)} ${formatTimeRange(appointment.startTime, appointment.endTime)}`} />
            <DetailTile icon="directions-car" title="Veículo" value={appointment.vehicleInfo || 'Não informado'} />
            <DetailTile icon="build" title="Serviço" value={appointment.notes || 'Sem descrição'} />
            <DetailTile
              icon="call"
              title="Telefone"
              value={appointment.mechanicPhone ? formatPhone(appointment.mechanicPhone) : 'Não informado'}
            />
          </View>
        </View>

        <View style={styles.actions}>
          {appointment.mechanicPhone ? (
            <PrimaryButton
              title="Falar com Mecânico"
              variant="whatsapp"
              leftIcon={<MaterialIcons name="chat" size={18} color={colors.onPrimary} />}
              onPress={handleWhatsApp}
            />
          ) : null}

          {appointment.status === 'pending' ? (
            <View style={styles.cancelWrap}>
              <PrimaryButton
                title="Cancelar Agendamento"
                variant="outlined"
                onPress={handleCancel}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailTile({ icon, title, value }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; value: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHeader}>
        <MaterialIcons name={icon} size={16} color={colors.secondary} />
        <Text style={styles.tileTitle}>{title}</Text>
      </View>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  notFoundWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.gutterMobile,
  },
  notFoundText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  content: {
    padding: spacing.gutterMobile,
    gap: spacing.md,
  },
  detailCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.sm,
    ...shadow.medium,
  },
  mechanicRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  mechanicInfo: {
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  tile: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tileTitle: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  tileValue: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  cancelWrap: {
    marginTop: spacing.xs,
  },
});
