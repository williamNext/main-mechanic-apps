import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AdminShell } from '@/components/admin/AdminShell';
import { CalendarDateInput, EmptyState, LoadingState, MetricCard, MiniBarChart, Panel, SectionHeader } from '@/components/ui/AdminControls';
import { useAdminStore } from '@/stores/admin-store';
import { formatDateDayMonthDisplay } from '@/utils/date';

export default function DashboardScreen() {
  const { dashboard, filters, loading, error, setFilters, fetchDashboard } = useAdminStore();

  useEffect(() => {
    void fetchDashboard();
  }, [filters.from, filters.to, fetchDashboard]);

  return (
    <AdminShell title="Painel">
      <Panel>
        <SectionHeader title="Período do relatório" />
        <View style={styles.filters}>
          <CalendarDateInput label="De" value={filters.from} onChangeDate={(from) => setFilters({ from })} />
          <CalendarDateInput label="Até" value={filters.to} onChangeDate={(to) => setFilters({ to })} />
        </View>
      </Panel>

      {loading.dashboard ? <LoadingState /> : null}
      {error ? <EmptyState title="Falha na solicitação" body={error} /> : null}

      {dashboard ? (
        <>
          <View style={styles.metrics}>
            <MetricCard label="Mecânicos" value={dashboard.mechanics.total} />
            <MetricCard label="Agendamentos" value={dashboard.appointments.total} />
            <MetricCard label="Confirmados" value={dashboard.appointments.confirmed} tone="good" />
            <MetricCard label="Cancelados" value={dashboard.appointments.canceled} tone="danger" />
            <MetricCard label="Horários disponíveis" value={dashboard.slots.upcomingAvailable} />
          </View>

          <Panel>
            <SectionHeader title="Agendamentos por dia" />
            <MiniBarChart values={dashboard.appointmentsByDay.map((row) => ({ label: formatDateDayMonthDisplay(row.date), value: row.total }))} />
          </Panel>

          <Panel>
            <SectionHeader title="Mecânicos em destaque" />
            {dashboard.topMechanics.length === 0 ? (
              <EmptyState title="Sem agendamentos" body="Nenhuma atividade de mecânico encontrada no período selecionado." />
            ) : (
              <View style={styles.list}>
                {dashboard.topMechanics.map((mechanic) => (
                  <View key={mechanic.mechanicId} style={styles.listRow}>
                    <View>
                      <Text style={styles.rowTitle}>{mechanic.mechanicName}</Text>
                      <Text style={styles.rowMeta}>{mechanic.specialty}</Text>
                    </View>
                    <Text style={styles.rowCount}>{mechanic.appointments}</Text>
                  </View>
                ))}
              </View>
            )}
          </Panel>
        </>
      ) : null}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  list: {
    gap: 8,
  },
  listRow: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowTitle: {
    color: '#101828',
    fontSize: 14,
    fontWeight: '800',
  },
  rowMeta: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
  },
  rowCount: {
    color: '#101828',
    fontSize: 18,
    fontWeight: '800',
  },
});
