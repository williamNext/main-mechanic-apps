import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  DataTable,
  EmptyState,
  LoadingState,
  MetricCard,
  Panel,
  SectionHeader,
  StatusPill,
} from '@/components/ui/AdminControls';
import { useAdminStore } from '@/stores/admin-store';
import { formatDateDisplay } from '@/utils/date';

function safeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function appointmentLabel(status: string) {
  if (status === 'cancelado') return 'Cancelado';
  if (status === 'nao_finalizado') return 'Nao finalizado';
  if (status === 'acabado') return 'Finalizado';
  return 'Confirmado';
}

function appointmentTone(status: string) {
  if (status === 'cancelado') return 'danger' as const;
  if (status === 'nao_finalizado') return 'warn' as const;
  if (status === 'acabado') return 'neutral' as const;
  return 'good' as const;
}

export default function MechanicDetailScreen() {
  const id = safeParam(useLocalSearchParams<{ id: string }>().id);
  const { selectedMechanic, loading, error, fetchMechanicDetail } = useAdminStore();

  useEffect(() => {
    if (id) void fetchMechanicDetail(id);
  }, [id, fetchMechanicDetail]);

  const mechanic = selectedMechanic?.mechanic;

  return (
    <AdminShell title="Detalhe do mecânico">
      {loading.detail ? <LoadingState /> : null}
      {error ? <EmptyState title="Falha na solicitação" body={error} /> : null}
      {!mechanic && !loading.detail ? <EmptyState title="Mecânico não encontrado" body="Registro indisponível ou excluído." /> : null}

      {mechanic && selectedMechanic ? (
        <>
          <Panel>
            <SectionHeader
              title={mechanic.name}
            />
            <View style={styles.detailGrid}>
              <Info label="Especialidade" value={mechanic.specialty} />
              <Info label="Email" value={mechanic.email ?? 'Nenhum'} />
              <Info label="Telefone" value={mechanic.phone ?? 'Nenhum'} />
              <Info label="Credenciais" value={mechanic.credentials} />
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Status</Text>
                {mechanic.isActive ? <StatusPill label="Ativo" tone="good" /> : <StatusPill label="Inativo" tone="neutral" />}
              </View>
            </View>
          </Panel>

          <View style={styles.metrics}>
            <MetricCard label="Agendamentos" value={selectedMechanic.appointmentStats.total} />
            <MetricCard label="Confirmados" value={selectedMechanic.appointmentStats.confirmed} tone="good" />
            <MetricCard label="Cancelados" value={selectedMechanic.appointmentStats.canceled} tone="danger" />
            <MetricCard label="Horários disponíveis" value={selectedMechanic.slotStats.availableUpcoming} />
          </View>

          <Panel>
            <SectionHeader title="Agendamentos recentes" />
            {selectedMechanic.recentAppointments.length === 0 ? (
              <EmptyState title="Sem agendamentos" body="Nenhum agendamento recente para este mecânico." />
            ) : (
              <DataTable
                columns={[
                  { key: 'date', label: 'Data', width: 110 },
                  { key: 'time', label: 'Horário', width: 120 },
                  { key: 'client', label: 'Cliente', flex: 1 },
                  { key: 'status', label: 'Status', width: 120 },
                ]}
                rows={selectedMechanic.recentAppointments.map((appointment) => ({
                  date: formatDateDisplay(appointment.date),
                  time: `${appointment.startTime} - ${appointment.endTime}`,
                  client: appointment.clientName ?? 'Cliente',
                  status: <StatusPill label={appointmentLabel(appointment.status)} tone={appointmentTone(appointment.status)} />,
                }))}
                keyExtractor={(_, index) => selectedMechanic.recentAppointments[index]?.id ?? String(index)}
              />
            )}
          </Panel>


        </>
      ) : null}
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  infoBlock: {
    minWidth: 180,
    gap: 5,
  },
  infoLabel: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#101828',
    fontSize: 14,
    fontWeight: '700',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  history: {
    gap: 8,
  },
  historyRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
    paddingVertical: 10,
  },
  historyTitle: {
    color: '#101828',
    fontSize: 14,
    fontWeight: '800',
  },
  historyMeta: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
  },
});
