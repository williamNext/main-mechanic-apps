import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { addYears, endOfMonth, endOfYear, format, isValid, parseISO, startOfMonth, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  ActionButton,
  CalendarDateInput,
  DataTable,
  EmptyState,
  FinanceBarChart,
  LoadingState,
  MetricCard,
  Panel,
  SearchField,
  SectionHeader,
  SegmentedControl,
} from '@/components/ui/AdminControls';
import { useAdminStore } from '@/stores/admin-store';
import { formatDateDayMonthDisplay, formatDateDisplay, formatDateMonthDisplay } from '@/utils/date';

type FinanceViewMode = 'month' | 'year' | 'custom';

const financeViewOptions: { label: string; value: FinanceViewMode }[] = [
  { label: 'Mes', value: 'month' },
  { label: 'Ano', value: 'year' },
  { label: 'Intervalo', value: 'custom' },
];

function formatMoney(cents?: number | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);
}

function formatShortMoney(cents: number) {
  const value = cents / 100;
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toFixed(1)} mil`;
  return formatMoney(cents);
}

function MonthPickerInput({
  label,
  value,
  onChangeMonth,
}: {
  label: string;
  value: string;
  onChangeMonth: (value: string) => void;
}) {
  const selectedDate = parseISO(`${value}-01`);
  const safeSelectedDate = isValid(selectedDate) ? selectedDate : new Date();
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(() => startOfYear(safeSelectedDate));
  const months = useMemo(() => Array.from({ length: 12 }, (_, month) => new Date(visibleYear.getFullYear(), month, 1)), [visibleYear]);

  const openPicker = () => {
    setVisibleYear(startOfYear(safeSelectedDate));
    setOpen(true);
  };

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={openPicker} style={styles.fieldButton}>
        <CalendarDays size={15} color="#667085" />
        <Text style={styles.fieldButtonText}>{format(safeSelectedDate, 'MM/yyyy')}</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.periodBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.periodCard}>
            <View style={styles.periodHeader}>
              <Pressable accessibilityRole="button" onPress={() => setVisibleYear((current) => addYears(current, -1))} style={styles.periodNavButton}>
                <ChevronLeft size={18} color="#344054" />
              </Pressable>
              <Text style={styles.periodTitle}>{format(visibleYear, 'yyyy')}</Text>
              <Pressable accessibilityRole="button" onPress={() => setVisibleYear((current) => addYears(current, 1))} style={styles.periodNavButton}>
                <ChevronRight size={18} color="#344054" />
              </Pressable>
            </View>
            <View style={styles.monthGrid}>
              {months.map((month) => {
                const monthValue = format(month, 'yyyy-MM');
                const selected = monthValue === value;
                return (
                  <Pressable
                    key={monthValue}
                    accessibilityRole="button"
                    onPress={() => {
                      onChangeMonth(monthValue);
                      setOpen(false);
                    }}
                    style={[styles.periodOption, selected && styles.periodOptionSelected]}
                  >
                    <Text style={[styles.periodOptionText, selected && styles.periodOptionTextSelected]}>{format(month, 'MMM', { locale: ptBR })}</Text>
                    <Text style={[styles.periodOptionMeta, selected && styles.periodOptionTextSelected]}>{format(month, 'MM/yyyy')}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function YearPickerInput({ label, value, onChangeYear }: { label: string; value: string; onChangeYear: (value: string) => void }) {
  const numericYear = /^\d{4}$/.test(value) ? Number(value) : new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [firstYear, setFirstYear] = useState(() => numericYear - (numericYear % 12));
  const years = useMemo(() => Array.from({ length: 12 }, (_, index) => firstYear + index), [firstYear]);

  const openPicker = () => {
    setFirstYear(numericYear - (numericYear % 12));
    setOpen(true);
  };

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={openPicker} style={styles.fieldButton}>
        <CalendarDays size={15} color="#667085" />
        <Text style={styles.fieldButtonText}>{value}</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.periodBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.periodCard}>
            <View style={styles.periodHeader}>
              <Pressable accessibilityRole="button" onPress={() => setFirstYear((current) => current - 12)} style={styles.periodNavButton}>
                <ChevronLeft size={18} color="#344054" />
              </Pressable>
              <Text style={styles.periodTitle}>
                {firstYear} - {firstYear + 11}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setFirstYear((current) => current + 12)} style={styles.periodNavButton}>
                <ChevronRight size={18} color="#344054" />
              </Pressable>
            </View>
            <View style={styles.monthGrid}>
              {years.map((year) => {
                const selected = String(year) === value;
                const disabled = year < 2000 || year > 2100;
                return (
                  <Pressable
                    key={year}
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => {
                      onChangeYear(String(year));
                      setOpen(false);
                    }}
                    style={[styles.periodOption, selected && styles.periodOptionSelected, disabled && styles.periodOptionDisabled]}
                  >
                    <Text style={[styles.yearOptionText, disabled && styles.periodOptionTextDisabled, selected && styles.periodOptionTextSelected]}>{year}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function FinanceScreen() {
  const { finance, filters, loading, error, setFilters, fetchFinancialReport } = useAdminStore();
  const now = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<FinanceViewMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => format(startOfMonth(now), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(() => format(now, 'yyyy'));

  const applyMonth = (month: string) => {
    const date = parseISO(`${month}-01`);
    if (!isValid(date)) return;
    setFilters({
      from: format(startOfMonth(date), 'yyyy-MM-dd'),
      to: format(endOfMonth(date), 'yyyy-MM-dd'),
    });
  };

  const applyYear = (year: string) => {
    if (!/^\d{4}$/.test(year)) return;
    const numericYear = Number(year);
    if (numericYear < 2000 || numericYear > 2100) return;
    const date = new Date(numericYear, 0, 1);
    setFilters({
      from: format(startOfYear(date), 'yyyy-MM-dd'),
      to: format(endOfYear(date), 'yyyy-MM-dd'),
    });
  };

  const changeViewMode = (nextMode: FinanceViewMode) => {
    setViewMode(nextMode);
    if (nextMode === 'month') applyMonth(selectedMonth);
    if (nextMode === 'year') applyYear(selectedYear);
  };

  const changeSelectedMonth = (month: string) => {
    setSelectedMonth(month);
    if (/^\d{4}-\d{2}$/.test(month)) applyMonth(month);
  };

  const changeSelectedYear = (year: string) => {
    setSelectedYear(year);
    applyYear(year);
  };

  useEffect(() => {
    void fetchFinancialReport();
  }, [filters.from, filters.to, filters.mechanicId, fetchFinancialReport]);

  const appointmentRows = (finance?.appointments ?? []).map((appointment) => ({
    date: formatDateDisplay(appointment.date),
    client: appointment.clientName ?? 'Cliente',
    mechanic: appointment.mechanicName ?? 'Mecanico',
    vehicle: appointment.vehicleInfo ?? 'Nenhum',
    service: appointment.serviceSummary ?? 'Sem resumo',
    value: formatMoney(appointment.totalAmountCents),
  }));

  const useMonthlyTrend = viewMode === 'year' || (viewMode === 'custom' && (finance?.revenueByDay.length ?? 0) > 62);
  const trendValues = useMonthlyTrend
    ? (finance?.revenueByMonth ?? []).map((row) => ({ label: formatDateMonthDisplay(`${row.month}-01`), value: row.revenueCents, meta: row.appointments }))
    : (finance?.revenueByDay ?? []).map((row) => ({ label: formatDateDayMonthDisplay(row.date), value: row.revenueCents, meta: row.appointments }));
  const overviewTitle = viewMode === 'year' ? 'Visao geral do ano' : viewMode === 'month' ? 'Visao geral do mes' : 'Visao geral do intervalo';
  const trendTitle = useMonthlyTrend ? 'Receita por mes' : 'Receita por dia';

  const mechanicChartValues = (finance?.byMechanic ?? []).slice(0, 6).map((row) => ({
    label: row.mechanicName,
    value: row.revenueCents,
    meta: row.appointments,
  }));

  const serviceChartValues = (finance?.byService ?? []).slice(0, 6).map((row) => ({
    label: row.description,
    value: row.revenueCents,
    meta: row.quantity,
  }));

  return (
    <AdminShell title="Financeiro">
      <Panel>
        <SectionHeader title="Controles financeiros" />
        <View style={styles.filters}>
          <SegmentedControl value={viewMode} options={financeViewOptions} onChange={changeViewMode} />
          {viewMode === 'month' ? (
            <MonthPickerInput label="Mes" value={selectedMonth} onChangeMonth={changeSelectedMonth} />
          ) : null}
          {viewMode === 'year' ? (
            <YearPickerInput label="Ano" value={selectedYear} onChangeYear={changeSelectedYear} />
          ) : null}
          {viewMode === 'custom' ? (
            <>
              <CalendarDateInput label="De" value={filters.from} onChangeDate={(from) => setFilters({ from })} />
              <CalendarDateInput label="Ate" value={filters.to} onChangeDate={(to) => setFilters({ to })} />
            </>
          ) : null}
          <SearchField value={filters.search} placeholder="Cliente, mecanico, veiculo, servico" onChangeText={(search) => setFilters({ search })} onSubmitEditing={() => fetchFinancialReport()} />
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
            <SectionHeader title={overviewTitle} />
            <Text style={styles.rangeText}>
              {formatDateDisplay(finance.range.from)} ate {formatDateDisplay(finance.range.to)}
            </Text>
            <Text style={styles.chartSubtitle}>{trendTitle}</Text>
            <FinanceBarChart values={trendValues} valueFormatter={formatShortMoney} emptyLabel="Sem receita no periodo." />
          </Panel>

          <View style={styles.chartGrid}>
            <Panel style={styles.chartPanel}>
              <SectionHeader title="Grafico por mecanico" />
              <FinanceBarChart values={mechanicChartValues} valueFormatter={formatShortMoney} emptyLabel="Sem valores por mecanico." />
            </Panel>
            <Panel style={styles.chartPanel}>
              <SectionHeader title="Grafico por servico" />
              <FinanceBarChart values={serviceChartValues} valueFormatter={formatShortMoney} emptyLabel="Sem valores por servico." />
            </Panel>
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
  fieldBlock: {
    gap: 5,
    minWidth: 132,
  },
  fieldLabel: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  fieldInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#101828',
    fontSize: 13,
    fontWeight: '700',
    outlineStyle: 'none' as never,
  },
  fieldButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  fieldButtonText: {
    color: '#101828',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  periodBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  periodCard: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 12,
    boxShadow: '0 12px 28px rgba(16, 24, 40, 0.18)',
  },
  periodHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  periodTitle: {
    flex: 1,
    color: '#101828',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  periodNavButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodOption: {
    width: '31.75%',
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#ffffff',
  },
  periodOptionSelected: {
    backgroundColor: '#101828',
    borderColor: '#101828',
  },
  periodOptionDisabled: {
    opacity: 0.45,
  },
  periodOptionText: {
    color: '#101828',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  periodOptionMeta: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  yearOptionText: {
    color: '#101828',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  periodOptionTextSelected: {
    color: '#ffffff',
  },
  periodOptionTextDisabled: {
    color: '#98a2b3',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chartPanel: {
    flex: 1,
    minWidth: 280,
  },
  rangeText: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  chartSubtitle: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '800',
  },
  muted: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
  },
});
