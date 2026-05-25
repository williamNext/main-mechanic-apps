import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Download } from 'lucide-react-native';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  ActionButton,
  DataTable,
  CalendarDateInput,
  EmptyState,
  LoadingState,
  PaginationBar,
  Panel,
  SearchField,
  SectionHeader,
  SegmentedControl,
  StatusPill,
} from '@/components/ui/AdminControls';
import { appointmentStatusOptions } from '@/features/admin/filter-utils';
import * as adminService from '@/services/admin-service';
import { useAdminStore } from '@/stores/admin-store';
import { AdminMechanicRow } from '@/types/models';
import { appointmentsToCsv, downloadCsv } from '@/utils/csv';
import { formatDateDisplay } from '@/utils/date';

function appointmentTone(status: string) {
  if (status === 'cancelado') return 'danger' as const;
  if (status === 'nao_finalizado') return 'warn' as const;
  if (status === 'acabado') return 'neutral' as const;
  return 'good' as const;
}

function appointmentLabel(status: string) {
  if (status === 'cancelado') return 'Cancelado';
  if (status === 'nao_finalizado') return 'Nao finalizado';
  if (status === 'acabado') return 'Finalizado';
  return 'Confirmado';
}

function formatMoney(cents?: number | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);
}

export default function AppointmentsScreen() {
  const { appointments, filters, loading, error, setFilters, fetchAppointments } = useAdminStore();
  const [mechanics, setMechanics] = useState<AdminMechanicRow[]>([]);

  useEffect(() => {
    void fetchAppointments();
  }, [filters.from, filters.to, filters.status, filters.mechanicId, filters.page, filters.pageSize, fetchAppointments]);

  useEffect(() => {
    void adminService
      .fetchMechanics({ search: '', page: 1, pageSize: 100 })
      .then((result) => setMechanics(result.rows))
      .catch(() => setMechanics([]));
  }, []);

  const rows = appointments.rows.map((appointment) => ({
    date: formatDateDisplay(appointment.date),
    time: `${appointment.startTime} - ${appointment.endTime}`,
    client: (
      <View>
        <Text style={styles.primary}>{appointment.clientName ?? 'Cliente'}</Text>
        <Text style={styles.secondary}>{appointment.clientPhone ?? 'Sem telefone'}</Text>
      </View>
    ),
    mechanic: (
      <View>
        <Text style={styles.primary}>{appointment.mechanicName ?? 'Mecânico'}</Text>
        <Text style={styles.secondary}>{appointment.specialty ?? 'Geral'}</Text>
      </View>
    ),
    vehicle: appointment.vehicleInfo ?? 'Nenhum',
    service: (
      <View>
        <Text style={styles.primary}>{appointment.serviceSummary ?? 'Sem fechamento'}</Text>
        <Text style={styles.secondary}>{appointment.workPerformed ?? 'Sem detalhamento'}</Text>
      </View>
    ),
    value: formatMoney(appointment.totalAmountCents),
    status: <StatusPill label={appointmentLabel(appointment.status)} tone={appointmentTone(appointment.status)} />,
  }));

  return (
    <AdminShell title="Agendamentos">
      <Panel>
        <SectionHeader
          title="Filtros"
          action={
            <ActionButton
              label="Exportar CSV"
              variant="secondary"
              icon={<Download size={15} color="#344054" />}
              onPress={() => downloadCsv('agendamentos.csv', appointmentsToCsv(appointments.rows))}
            />
          }
        />
        <View style={styles.filters}>
          <CalendarDateInput label="De" value={filters.from} onChangeDate={(from) => setFilters({ from, page: 1 })} />
          <CalendarDateInput label="Até" value={filters.to} onChangeDate={(to) => setFilters({ to, page: 1 })} />
          <SearchField value={filters.search} placeholder="Cliente, mecânico, telefone, veículo" onChangeText={(search) => setFilters({ search, page: 1 })} onSubmitEditing={() => fetchAppointments({ page: 1 })} />
          <SegmentedControl value={filters.status} options={appointmentStatusOptions} onChange={(status) => setFilters({ status, page: 1 })} />
          <ActionButton label="Aplicar" variant="secondary" onPress={() => fetchAppointments({ page: 1 })} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.mechanicChips}>
            <Pressable onPress={() => setFilters({ mechanicId: null, page: 1 })} style={[styles.chip, !filters.mechanicId && styles.chipActive]}>
              <Text style={[styles.chipText, !filters.mechanicId && styles.chipTextActive]}>Todos os mecânicos</Text>
            </Pressable>
            {mechanics.map((mechanic) => (
              <Pressable
                key={mechanic.id}
                onPress={() => setFilters({ mechanicId: mechanic.id, page: 1 })}
                style={[styles.chip, filters.mechanicId === mechanic.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, filters.mechanicId === mechanic.id && styles.chipTextActive]}>{mechanic.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Panel>

      {loading.appointments ? <LoadingState /> : null}
      {error ? <EmptyState title="Falha na solicitação" body={error} /> : null}

      {!loading.appointments && rows.length === 0 ? (
        <EmptyState title="Sem agendamentos" body="Nenhum agendamento corresponde aos filtros atuais." />
      ) : (
        <Panel>
          <DataTable
            columns={[
              { key: 'date', label: 'Data', width: 108 },
              { key: 'time', label: 'Horário', width: 120 },
              { key: 'client', label: 'Cliente', flex: 1.2 },
              { key: 'mechanic', label: 'Mecânico', flex: 1.2 },
              { key: 'vehicle', label: 'Veículo', flex: 1 },
              { key: 'service', label: 'Servico', flex: 1.4 },
              { key: 'value', label: 'Valor', width: 108 },
              { key: 'status', label: 'Status', width: 122 },
            ]}
            rows={rows}
            keyExtractor={(_, index) => appointments.rows[index]?.id ?? String(index)}
          />
          <PaginationBar
            page={appointments.page}
            pageSize={appointments.pageSize}
            total={appointments.total}
            onPageChange={(page) => fetchAppointments({ page })}
          />
        </Panel>
      )}
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
  mechanicChips: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#101828',
    borderColor: '#101828',
  },
  chipText: {
    color: '#344054',
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  primary: {
    color: '#101828',
    fontSize: 13,
    fontWeight: '800',
  },
  secondary: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
  },
});
