import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppointmentStore } from '@/stores/appointment-store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FontSize, FontWeight, Spacing } from '@/constants/theme';
import { formatDate } from '@/utils/date';
import { formatPhone, toBrazilWhatsAppPhone } from '@/utils/format';
import { useAppTheme } from '@/hooks/use-theme';

export default function AppointmentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { appointments } = useAppointmentStore();
  const { colors } = useAppTheme();

  const appointment = appointments.find((a) => a.id === id);

  if (!appointment) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.gray500 }}>Agendamento não encontrado.</Text>
      </View>
    );
  }

  const handleWhatsApp = () => {
    const whatsappPhone = appointment.mechanicPhone
      ? toBrazilWhatsAppPhone(appointment.mechanicPhone)
      : null;

    if (whatsappPhone) {
      const mechanicName = appointment.mechanicName || 'mecânico';
      const message = `Olá ${mechanicName}, sobre o meu agendamento do dia ${formatDate(appointment.date)} às ${appointment.startTime}...`;
      Linking.openURL(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`)
        .catch(() => alert('Não foi possível abrir o WhatsApp.'));
    } else {
      alert('Número de telefone do mecânico não disponível.');
    }
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.gray200 }]}>
        <Text style={[styles.title, { color: colors.gray900 }]}>Detalhes do Agendamento</Text>
        <Badge
          label={statusLabels[appointment.status] || appointment.status}
          variant={
            appointment.status === 'confirmed' ? 'success' :
            appointment.status === 'pending' ? 'warning' :
            appointment.status === 'cancelled' ? 'error' : 'default'
          }
        />
      </View>

      <View style={styles.content}>
        <Card style={styles.card}>
          <DetailRow icon="person-outline" label="Mecânico" value={appointment.mechanicName || '—'} colors={colors} />
          {appointment.mechanicPhone && (
            <DetailRow icon="call-outline" label="Telefone" value={formatPhone(appointment.mechanicPhone)} colors={colors} />
          )}
          <DetailRow icon="calendar-outline" label="Data" value={formatDate(appointment.date)} colors={colors} />
          <DetailRow icon="time-outline" label="Horário" value={`${appointment.startTime} - ${appointment.endTime}`} colors={colors} />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.gray900 }]}>Detalhes do Serviço</Text>
          <View style={{ marginTop: Spacing.sm }}>
            <Text style={[styles.label, { color: colors.gray500 }]}>Modelo do Veículo</Text>
            <Text style={[styles.value, { color: colors.gray900 }]}>{appointment.vehicleInfo || '—'}</Text>
          </View>
          <View style={{ marginTop: Spacing.md }}>
            <Text style={[styles.label, { color: colors.gray500 }]}>Problema Relatado</Text>
            <Text style={[styles.value, { color: colors.gray900 }]}>{appointment.notes || '—'}</Text>
          </View>
        </Card>

        {appointment.mechanicPhone && (
          <Button
            title="Contatar via WhatsApp"
            onPress={handleWhatsApp}
            icon={<Ionicons name="logo-whatsapp" size={20} color={colors.white} />}
            style={styles.whatsappBtn}
          />
        )}
      </View>
    </ScrollView>
  );
}

function DetailRow({ icon, label, value, colors }: { icon: any; label: string; value: string; colors: any }) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.gray100 }]}>
      <Ionicons name={icon} size={20} color={colors.gray400} />
      <View style={styles.rowContent}>
        <Text style={[styles.label, { color: colors.gray500 }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.gray900 }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    padding: Spacing.xxl,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  content: {
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  whatsappBtn: {
    backgroundColor: '#25D366', // WhatsApp green
    marginTop: Spacing.md,
  },
});
