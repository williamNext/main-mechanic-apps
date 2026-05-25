import { StyleSheet, Text, View } from 'react-native';
import { AdminShell } from '@/components/admin/AdminShell';
import { ActionButton, Panel, SectionHeader } from '@/components/ui/AdminControls';
import { useAuth } from '@/hooks/use-auth';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const roleLabel = user?.role === 'admin' ? 'Administrador' : user?.role ?? 'Nenhuma';

  return (
    <AdminShell title="Configurações">
      <Panel>
        <SectionHeader title="Administrador atual" />
        <View style={styles.rows}>
          <Info label="Nome" value={user?.name ?? 'Desconhecido'} />
          <Info label="Email" value={user?.email ?? 'Nenhum'} />
          <Info label="Função" value={roleLabel} />
        </View>
      </Panel>

      <Panel>
        <SectionHeader title="Sessão" />
        <ActionButton label="Sair" variant="danger" onPress={() => void logout()} />
      </Panel>
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: 12,
  },
  info: {
    gap: 4,
  },
  label: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  value: {
    color: '#101828',
    fontSize: 14,
    fontWeight: '700',
  },
});
