import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Download } from 'lucide-react-native';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  ActionButton,
  DataTable,
  EmptyState,
  LoadingState,
  PaginationBar,
  Panel,
  SearchField,
  SectionHeader,
  SegmentedControl,
  StatusPill,
} from '@/components/ui/AdminControls';
import { mechanicStatusOptions } from '@/features/admin/filter-utils';
import { useAdminStore } from '@/stores/admin-store';
import { downloadCsv, mechanicsToCsv } from '@/utils/csv';

function approvalStatus(isActive: boolean, credentials: string) {
  if (isActive) return <StatusPill label="Ativo" tone="good" />;
  if (credentials === 'PENDENTE') return <StatusPill label="Pendente" tone="warn" />;
  return <StatusPill label="Inativo" tone="neutral" />;
}

export default function MechanicsScreen() {
  const router = useRouter();
  const { mechanics, filters, loading, error, setFilters, fetchMechanics } = useAdminStore();

  useEffect(() => {
    void fetchMechanics();
  }, [fetchMechanics, filters.mechanicStatus, filters.page, filters.pageSize]);

  const rows = mechanics.rows.map((mechanic) => ({
    name: (
      <Pressable onPress={() => router.push(`/(admin)/mechanics/${mechanic.id}` as never)}>
        <Text style={styles.linkText}>{mechanic.name}</Text>
        <Text style={styles.metaText}>{mechanic.email ?? mechanic.phone ?? 'Sem contato'}</Text>
      </Pressable>
    ),
    specialty: mechanic.specialty,
    status: approvalStatus(mechanic.isActive, mechanic.credentials),
    appointments: `${mechanic.appointmentsTotal ?? 0}`,
    last: mechanic.lastAppointmentDate ?? 'Nenhum',
  }));

  return (
    <AdminShell title="Mecânicos">
      <Panel>
        <SectionHeader
          title="Diretório"
          action={
            <ActionButton
              label="Exportar CSV"
              variant="secondary"
              icon={<Download size={15} color="#344054" />}
              onPress={() => downloadCsv('mecanicos.csv', mechanicsToCsv(mechanics.rows))}
            />
          }
        />
        <View style={styles.filters}>
          <SearchField value={filters.search} onChangeText={(search) => setFilters({ search, page: 1 })} />
          <SegmentedControl
            value={filters.mechanicStatus}
            options={mechanicStatusOptions}
            onChange={(mechanicStatus) => setFilters({ mechanicStatus, page: 1 })}
          />
          <ActionButton label="Aplicar" variant="secondary" onPress={() => fetchMechanics({ page: 1 })} />
        </View>
      </Panel>

      {loading.mechanics ? <LoadingState /> : null}
      {error ? <EmptyState title="Falha na solicitação" body={error} /> : null}

      {!loading.mechanics && rows.length === 0 ? (
        <EmptyState title="Sem mecânicos" body="Nenhum mecânico corresponde aos filtros atuais." />
      ) : (
        <Panel>
          <DataTable
            columns={[
              { key: 'name', label: 'Mecânico', flex: 1.6 },
              { key: 'specialty', label: 'Especialidade', flex: 1 },
              { key: 'status', label: 'Status', width: 120 },
              { key: 'appointments', label: 'Agendamentos', width: 120 },
              { key: 'last', label: 'Último agendamento', width: 130 },
            ]}
            rows={rows}
            keyExtractor={(_, index) => mechanics.rows[index]?.id ?? String(index)}
          />
          <PaginationBar
            page={mechanics.page}
            pageSize={mechanics.pageSize}
            total={mechanics.total}
            onPageChange={(page) => fetchMechanics({ page })}
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
    alignItems: 'center',
  },
  linkText: {
    color: '#101828',
    fontSize: 13,
    fontWeight: '800',
  },
  metaText: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
  },
});
