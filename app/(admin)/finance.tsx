import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Download } from 'lucide-react-native';
import { AdminShell } from '@/components/admin/AdminShell';
import { ActionButton, DataTable, DateInput, EmptyState, LoadingState, MetricCard, Panel, SearchField, SectionHeader } from '@/components/ui/AdminControls';
import { useAdminStore } from '@/stores/admin-store';
import { downloadCsv, financeToCsv } from '@/utils/csv';

function formatMoney(cents?: number | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);
}

export default function FinanceScreen() {
  const { finance, filters, loading, error, setFilters, fetchFinancialReport } = useAdminStore();

  useEffect(() => {
    void fetchFinancialReport();
  }, [filters.from, filters.to, filters.mechanicId, fetchFinancialReport]);

  const appointmentRows = (finance?.appointments ?? []).map((appointment) => ({
    date: appointment.date,
    client: appointment.clientName ?? 'Cliente',
    mechanic: appointment.mechanicName ?? 'Mecanico',
    vehicle: appointment.vehicleInfo ?? 'Nenhum',
    service: appointment.serviceSummary ?? 'Sem resumo',
    value: formatMoney(appointment.totalAmountCents),
  }));

  const serviceRows = (finance?.byService ?? []).map((service) => ({
    description: service.description,
    quantity: service.quantity,
    value: formatMoney(service.revenueCents),
  }));

  return (
    <AdminShell title="Financeiro">
      <Panel>
        <SectionHeader
          title="Controles financeiros"
          action={
            finance ? (
              <ActionButton
                label="Exportar CSV"
                variant="secondary"
                icon={<Download size={15} color="#344054" />}
                onPress={() => downloadCsv('financeiro.csv', financeToCsv(finance))}
              />
            ) : null
          }
        />
        <View style={styles.filters}>
          <DateInput label="De" value={filters.from} onChangeText={(from) => setFilters({ from })} />
          <DateInput label="Ate" value={filters.to} onChangeText={(to) => setFilters({ to })} />
          <SearchField value={filters.search} placeholder="Cliente, mecanico, veiculo, servico" onChangeText={(search) => setFilters({ search })} />
          <ActionButton label="Atualizar" variant="secondary" onPress={() => fetchFinancialReport()} />
        </View>
      </Panel>

      {loading.finance ? <LoadingState /> : null}
      {error ? <EmptyState title="Falha na solicitacao" body={error} /> : null}

      {finance ? (
        <>
          <View style={styles.metrics}>
            <MetricCard label="Receita total" value={formatMoney(finance.summary.revenueCents)} tone="good" />
            <MetricCard label="Servicos finalizados" value={finance.summary.appointments} />
            <MetricCard label="Ticket medio" value={formatMoney(finance.summary.averageTicketCents)} />
          </View>

          <Panel>
            <SectionHeader title="Receita por mecanico" />
            {finance.byMechanic.length === 0 ? (
              <Text style={styles.muted}>Sem valores finalizados no periodo.</Text>
            ) : (
              <DataTable
                columns={[
                  { key: 'mechanic', label: 'Mecanico', flex: 1 },
                  { key: 'appointments', label: 'Servicos', width: 92 },
                  { key: 'value', label: 'Receita', width: 120 },
                ]}
                rows={finance.byMechanic.map((row) => ({
                  mechanic: row.mechanicName,
                  appointments: row.appointments,
                  value: formatMoney(row.revenueCents),
                }))}
                keyExtractor={(row) => String(row.mechanic)}
              />
            )}
          </Panel>

          <Panel>
            <SectionHeader title="Receita por servico" />
            {serviceRows.length === 0 ? (
              <Text style={styles.muted}>Sem itens de servico no periodo.</Text>
            ) : (
              <DataTable
                columns={[
                  { key: 'description', label: 'Servico', flex: 1 },
                  { key: 'quantity', label: 'Qtd', width: 72 },
                  { key: 'value', label: 'Receita', width: 120 },
                ]}
                rows={serviceRows}
                keyExtractor={(row, index) => `${row.description}-${index}`}
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
                  { key: 'mechanic', label: 'Mecanico', flex: 1 },
                  { key: 'vehicle', label: 'Veiculo', flex: 1 },
                  { key: 'service', label: 'Servico', flex: 1.3 },
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
  muted: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
  },
});
