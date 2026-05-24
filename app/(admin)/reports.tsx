import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Download } from 'lucide-react-native';
import { AdminShell } from '@/components/admin/AdminShell';
import { ActionButton, DateInput, MetricCard, MiniBarChart, Panel, SectionHeader } from '@/components/ui/AdminControls';
import { useAdminStore } from '@/stores/admin-store';
import { appointmentsToCsv, downloadCsv, financeToCsv, mechanicsToCsv } from '@/utils/csv';

function formatMoney(cents?: number | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);
}

export default function ReportsScreen() {
  const {
    dashboard,
    mechanics,
    appointments,
    finance,
    filters,
    setFilters,
    fetchDashboard,
    fetchMechanics,
    fetchAppointments,
    fetchFinancialReport,
  } = useAdminStore();

  useEffect(() => {
    void fetchDashboard();
    void fetchMechanics({ page: 1, pageSize: 100 });
    void fetchAppointments({ page: 1, pageSize: 100 });
    void fetchFinancialReport();
  }, [filters.from, filters.to, fetchDashboard, fetchMechanics, fetchAppointments, fetchFinancialReport]);

  return (
    <AdminShell title="Relatorios">
      <Panel>
        <SectionHeader title="Controles do relatorio" />
        <View style={styles.filters}>
          <DateInput label="De" value={filters.from} onChangeText={(from) => setFilters({ from, page: 1 })} />
          <DateInput label="Ate" value={filters.to} onChangeText={(to) => setFilters({ to, page: 1 })} />
          <ActionButton
            label="Atualizar"
            variant="secondary"
            onPress={() => {
              void fetchDashboard();
              void fetchMechanics({ page: 1, pageSize: 100 });
              void fetchAppointments({ page: 1, pageSize: 100 });
              void fetchFinancialReport();
            }}
          />
          <ActionButton
            label="CSV de mecanicos"
            variant="secondary"
            icon={<Download size={15} color="#344054" />}
            onPress={() => downloadCsv('relatorio-mecanicos.csv', mechanicsToCsv(mechanics.rows))}
          />
          <ActionButton
            label="CSV de agendamentos"
            variant="secondary"
            icon={<Download size={15} color="#344054" />}
            onPress={() => downloadCsv('relatorio-agendamentos.csv', appointmentsToCsv(appointments.rows))}
          />
          {finance ? (
            <ActionButton
              label="CSV financeiro"
              variant="secondary"
              icon={<Download size={15} color="#344054" />}
              onPress={() => downloadCsv('relatorio-financeiro.csv', financeToCsv(finance))}
            />
          ) : null}
        </View>
      </Panel>

      {dashboard ? (
        <>
          <View style={styles.metrics}>
            <MetricCard label="Total de agendamentos" value={dashboard.appointments.total} />
            <MetricCard label="Finalizados" value={dashboard.appointments.finished} />
            <MetricCard label="Nao finalizados" value={dashboard.appointments.unfinished} tone="warn" />
            <MetricCard label="Cancelados" value={dashboard.appointments.canceled} tone="danger" />
            <MetricCard label="Receita" value={formatMoney(dashboard.appointments.revenueCents)} tone="good" />
            <MetricCard label="Mecanicos ativos" value={dashboard.mechanics.active} tone="good" />
          </View>
          <Panel>
            <SectionHeader title="Tendencia de volume" />
            <MiniBarChart values={dashboard.appointmentsByDay.map((row) => ({ label: row.date, value: row.total }))} />
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
    gap: 10,
    alignItems: 'flex-end',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
