import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  ActionButton,
  CalendarDateInput,
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
  const { selectedMechanic, filters, loading, error, setFilters, fetchMechanicDetail, reactivateMechanic } = useAdminStore();
  const [reactivationOpen, setReactivationOpen] = useState(false);
  const [reactivationSucceeded, setReactivationSucceeded] = useState(false);

  useEffect(() => {
    if (id) void fetchMechanicDetail(id);
  }, [id, filters.from, filters.to, fetchMechanicDetail]);

  const mechanic = selectedMechanic?.mechanic;

  async function confirmReactivation() {
    if (!id) return;
    const ok = await reactivateMechanic(id);
    if (!ok) return;
    setReactivationOpen(false);
    setReactivationSucceeded(true);
  }

  return (
    <AdminShell title="Detalhe do mecânico">
      <Panel>
        <SectionHeader title="Período" />
        <View style={styles.rangeFilters}>
          <CalendarDateInput label="De" value={filters.from} onChangeDate={(from) => setFilters({ from })} />
          <CalendarDateInput label="Até" value={filters.to} onChangeDate={(to) => setFilters({ to })} />
        </View>
      </Panel>

      {loading.detail ? <LoadingState /> : null}
      {error ? <EmptyState title="Falha na solicitação" body={error} /> : null}
      {!mechanic && !loading.detail ? <EmptyState title="Mecânico não encontrado" body="Registro indisponível." /> : null}
      {reactivationSucceeded ? (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>Mecânico reativado.</Text>
        </View>
      ) : null}

      {mechanic && selectedMechanic ? (
        <>
          <Panel>
            <SectionHeader
              title={mechanic.name}
              action={
                !mechanic.isActive ? (
                  <ActionButton label="Reativar mecânico" variant="primary" onPress={() => setReactivationOpen(true)} />
                ) : undefined
              }
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
            <MetricCard label="Não finalizados" value={selectedMechanic.appointmentStats.unfinished ?? 0} />
            <MetricCard label="Finalizados" value={selectedMechanic.appointmentStats.finished} />
            <MetricCard label="Cancelados" value={selectedMechanic.appointmentStats.canceled} tone="danger" />
            <MetricCard label="Horários futuros" value={selectedMechanic.slotStats.totalUpcoming} />
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

      <Modal transparent visible={reactivationOpen} animationType="fade" onRequestClose={() => setReactivationOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reativar mecânico</Text>
            <Text style={styles.modalBody}>
              Reativar este mecânico o tornará disponível para novos agendamentos. Agendamentos cancelados durante a desativação não serão restaurados.
            </Text>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <ActionButton
                label="Cancelar"
                variant="secondary"
                disabled={loading.reactivateMechanic}
                onPress={() => setReactivationOpen(false)}
              />
              <ActionButton
                label="Reativar"
                variant="primary"
                loading={loading.reactivateMechanic}
                onPress={confirmReactivation}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  rangeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  successBanner: {
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#6ce9a6',
    borderRadius: 8,
    padding: 10,
  },
  successBannerText: {
    color: '#027a48',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#fef3f2',
    borderWidth: 1,
    borderColor: '#fda29b',
    borderRadius: 8,
    padding: 10,
  },
  errorBannerText: {
    color: '#b42318',
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 18,
    gap: 14,
  },
  modalTitle: {
    color: '#101828',
    fontSize: 17,
    fontWeight: '800',
  },
  modalBody: {
    color: '#475467',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
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
