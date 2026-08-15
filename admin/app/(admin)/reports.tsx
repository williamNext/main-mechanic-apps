import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Download } from 'lucide-react-native';
import { AdminShell } from '@/components/admin/AdminShell';
import { ActionButton, CalendarDateInput, DataTable, EmptyState, LoadingState, MetricCard, Panel, SectionHeader } from '@/components/ui/AdminControls';
import { useAdminStore } from '@/stores/admin-store';
import { downloadCsv, financeToCsv } from '@/utils/csv';
import { formatDateDisplay } from '@/utils/date';

function formatMoney(cents?: number | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);
}

export default function ReportsScreen() {
  const { finance, filters, loading, error, setFilters, fetchFinancialReport } = useAdminStore();

  useEffect(() => {
    void fetchFinancialReport();
  }, [filters.from, filters.to, filters.mechanicId, filters.search, fetchFinancialReport]);

  const appointmentRows = (finance?.appointments ?? []).map((appointment) => ({
    date: formatDateDisplay(appointment.date),
    client: appointment.clientName ?? 'Cliente',
    mechanic: appointment.mechanicName ?? 'Mecânico',
    service: appointment.serviceSummary ?? 'Sem resumo',
    value: formatMoney(appointment.totalAmountCents),
  }));

  return (
    <AdminShell title="Relatorios">
      <Panel>
        <SectionHeader title="Controles do relatorio" />
        <View style={styles.filters}>
          <CalendarDateInput label="De" value={filters.from} onChangeDate={(from) => setFilters({ from, page: 1 })} />
          <CalendarDateInput label="Ate" value={filters.to} onChangeDate={(to) => setFilters({ to, page: 1 })} />
          <ActionButton label="Atualizar" variant="secondary" onPress={() => void fetchFinancialReport()} />
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

      {loading.finance ? <LoadingState /> : null}
      {error ? <EmptyState title="Falha na solicitação" body={error} /> : null}

      {finance ? (
        <>
          <View style={styles.metrics}>
            <MetricCard label="Receita total" value={formatMoney(finance.summary.revenueCents)} tone="good" />
            <MetricCard label="Serviços finalizados" value={finance.summary.appointments} />
            <MetricCard label="Ticket médio" value={formatMoney(finance.summary.averageTicketCents)} />
          </View>

          <Panel>
            <SectionHeader title="Receita por mecânico" />
            <Text style={styles.rangeText}>
              {formatDateDisplay(finance.range.from)} até {formatDateDisplay(finance.range.to)}
            </Text>
            {finance.byMechanic.length === 0 ? (
              <EmptyState title="Sem mecânicos" body="Nenhum fechamento financeiro corresponde aos filtros atuais." />
            ) : (
              <DataTable
                columns={[
                  { key: 'mechanic', label: 'Mecânico', flex: 1 },
                  { key: 'specialty', label: 'Especialidade', flex: 1 },
                  { key: 'appointments', label: 'Serviços', width: 92 },
                  { key: 'value', label: 'Receita', width: 120 },
                ]}
                rows={finance.byMechanic.map((row) => ({
                  mechanic: row.mechanicName,
                  specialty: row.specialty,
                  appointments: row.appointments,
                  value: formatMoney(row.revenueCents),
                }))}
                keyExtractor={(_, index) => finance.byMechanic[index]?.mechanicId ?? String(index)}
              />
            )}
          </Panel>

          <Panel>
            <SectionHeader title="Receita por serviço" />
            {finance.byService.length === 0 ? (
              <EmptyState title="Sem serviços" body="Nenhum serviço finalizado corresponde aos filtros atuais." />
            ) : (
              <DataTable
                columns={[
                  { key: 'service', label: 'Serviço', flex: 1 },
                  { key: 'quantity', label: 'Quantidade', width: 108 },
                  { key: 'value', label: 'Receita', width: 120 },
                ]}
                rows={finance.byService.map((row) => ({
                  service: row.description,
                  quantity: row.quantity,
                  value: formatMoney(row.revenueCents),
                }))}
                keyExtractor={(row, index) => `${String(row.service)}-${index}`}
              />
            )}
          </Panel>

          <Panel>
            <SectionHeader title="Atendimentos finalizados" />
            {appointmentRows.length === 0 ? (
              <EmptyState title="Sem atendimentos" body="Nenhum fechamento financeiro corresponde aos filtros atuais." />
            ) : (
              <DataTable
                columns={[
                  { key: 'date', label: 'Data', width: 108 },
                  { key: 'client', label: 'Cliente', flex: 1 },
                  { key: 'mechanic', label: 'Mecânico', flex: 1 },
                  { key: 'service', label: 'Serviço', flex: 1.3 },
                  { key: 'value', label: 'Valor', width: 116 },
                ]}
                rows={appointmentRows}
                keyExtractor={(_, index) => finance.appointments[index]?.id ?? String(index)}
              />
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
    gap: 10,
    alignItems: 'flex-end',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  rangeText: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
});
