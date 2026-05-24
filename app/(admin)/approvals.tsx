import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
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
  StatusPill,
} from '@/components/ui/AdminControls';
import { useAdminStore } from '@/stores/admin-store';

export default function ApprovalsScreen() {
  const router = useRouter();
  const { mechanics, filters, loading, error, setFilters, fetchMechanics, setApproval } = useAdminStore();

  useEffect(() => {
    void fetchMechanics({ mechanicStatus: 'pending', page: 1 });
  }, [fetchMechanics]);

  const rows = mechanics.rows.map((mechanic) => ({
    name: (
      <Pressable onPress={() => router.push(`/(admin)/mechanics/${mechanic.id}` as never)}>
        <Text style={styles.linkText}>{mechanic.name}</Text>
        <Text style={styles.metaText}>{mechanic.email ?? mechanic.phone ?? 'Sem contato'}</Text>
      </Pressable>
    ),
    specialty: mechanic.specialty,
    credentials: mechanic.credentials,
    status: <StatusPill label="Pendente" tone="warn" />,
    actions: (
      <View style={styles.actions}>
        <ActionButton
          label="Aprovar"
          icon={<Check size={15} color="#ffffff" />}
          loading={loading.approval}
          onPress={() => setApproval({ mechanicId: mechanic.id, approved: true, credentials: 'APROVADO' })}
        />
        <ActionButton
          label="Rejeitar"
          variant="danger"
          icon={<X size={15} color="#ffffff" />}
          loading={loading.approval}
          onPress={() => setApproval({ mechanicId: mechanic.id, approved: false, credentials: 'REJEITADO' })}
        />
      </View>
    ),
  }));

  return (
    <AdminShell title="Aprovações">
      <Panel>
        <SectionHeader title="Mecânicos pendentes" />
        <View style={styles.filters}>
          <SearchField
            value={filters.search}
            placeholder="Buscar nome, telefone, especialidade"
            onChangeText={(search) => setFilters({ search, page: 1 })}
          />
          <ActionButton label="Aplicar" variant="secondary" onPress={() => fetchMechanics({ mechanicStatus: 'pending', page: 1 })} />
        </View>
      </Panel>

      {loading.mechanics ? <LoadingState /> : null}
      {error ? <EmptyState title="Falha na solicitação" body={error} /> : null}

      {!loading.mechanics && rows.length === 0 ? (
        <EmptyState title="Sem mecânicos pendentes" body="Fila de aprovação vazia." />
      ) : (
        <Panel>
          <DataTable
            columns={[
              { key: 'name', label: 'Mecânico', flex: 1.4 },
              { key: 'specialty', label: 'Especialidade', flex: 1 },
              { key: 'credentials', label: 'Credenciais', flex: 1 },
              { key: 'status', label: 'Status', width: 110 },
              { key: 'actions', label: 'Ações', width: 210 },
            ]}
            rows={rows}
            keyExtractor={(_, index) => mechanics.rows[index]?.id ?? String(index)}
          />
          <PaginationBar
            page={mechanics.page}
            pageSize={mechanics.pageSize}
            total={mechanics.total}
            onPageChange={(page) => fetchMechanics({ page, mechanicStatus: 'pending' })}
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
  actions: {
    flexDirection: 'row',
    gap: 8,
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
