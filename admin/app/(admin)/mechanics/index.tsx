import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckSquare, Download, Plus, Square, UserMinus } from 'lucide-react-native';
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
import { DeactivateMechanicsResult } from '@main-mechanic/types';
import { downloadCsv, mechanicsToCsv } from '@/utils/csv';
import { formatDateDisplay } from '@/utils/date';
import { formatPhone } from '@/utils/format';

const DEACTIVATE_CONFIRMATION_WORD = 'DESATIVAR';

function approvalStatus(isActive: boolean, credentials: string) {
  if (isActive) return <StatusPill label="Ativo" tone="good" />;
  return <StatusPill label="Inativo" tone="neutral" />;
}

export default function MechanicsScreen() {
  const router = useRouter();
  const { mechanics, filters, loading, error, setFilters, fetchMechanics, deactivateMechanics, createMechanic } = useAdminStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmWord, setConfirmWord] = useState('');
  const [deactivationResult, setDeactivationResult] = useState<DeactivateMechanicsResult | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [credentials, setCredentials] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function openCreateModal() {
    setName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setSpecialty('');
    setCredentials('');
    setShowPassword(false);
    setValidationError(null);
    setCreateOpen(true);
  }

  async function handleCreateMechanic() {
    setValidationError(null);
    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim() || !specialty.trim() || !credentials.trim()) {
      setValidationError('Todos os campos são obrigatórios.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 11) {
      setValidationError('O celular deve conter DDD e 9 dígitos (ex: 11999999999).');
      return;
    }
    if (password.length < 8) {
      setValidationError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setValidationError('Digite um e-mail válido.');
      return;
    }

    const ok = await createMechanic({
      name: name.trim(),
      phone: cleanPhone,
      email: email.trim().toLowerCase(),
      password,
      specialty: specialty.trim(),
      credentials: credentials.trim(),
    });

    if (ok) {
      setCreateOpen(false);
    } else {
      const globalError = useAdminStore.getState().error;
      setValidationError(globalError || 'Falha ao criar mecânico.');
    }
  }

  useEffect(() => {
    void fetchMechanics();
  }, [fetchMechanics, filters.page, filters.pageSize]);

  const visibleIds = useMemo(() => mechanics.rows.map((mechanic) => mechanic.id), [mechanics.rows]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;
  const confirmationMatches = confirmWord.trim().toUpperCase() === DEACTIVATE_CONFIRMATION_WORD;

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => visibleIds.includes(id))));
  }, [visibleIds]);

  function toggleSelection(mechanicId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(mechanicId)) {
        next.delete(mechanicId);
      } else {
        next.add(mechanicId);
      }
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function confirmDeactivation() {
    const result = await deactivateMechanics([...selectedIds]);
    if (!result) return;
    setDeactivationResult(result);
    setConfirmOpen(false);
    setConfirmWord('');
    setSelectedIds(new Set());
  }

  const rows = mechanics.rows.map((mechanic) => ({
    select: (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selectedIds.has(mechanic.id) }}
        onPress={() => toggleSelection(mechanic.id)}
        style={styles.checkboxButton}
        testID={`select-mechanic-${mechanic.id}`}
      >
        {selectedIds.has(mechanic.id) ? <CheckSquare size={18} color="#b42318" /> : <Square size={18} color="#667085" />}
      </Pressable>
    ),
    name: (
      <Pressable onPress={() => router.push(`/(admin)/mechanics/${mechanic.id}` as never)}>
        <Text style={styles.linkText}>{mechanic.name}</Text>
        <Text style={styles.metaText}>{mechanic.email ?? mechanic.phone ?? 'Sem contato'}</Text>
      </Pressable>
    ),
    specialty: mechanic.specialty,
    status: approvalStatus(mechanic.isActive, mechanic.credentials),
    appointments: `${mechanic.appointmentsTotal ?? 0}`,
    last: formatDateDisplay(mechanic.lastAppointmentDate) || 'Nenhum',
  }));

  return (
    <AdminShell title="Mecânicos">
      <Panel>
        <SectionHeader
          title="Diretório"
          action={
            <View style={styles.headerActions}>
              <ActionButton
                label="Adicionar mecânico"
                variant="primary"
                testID="add-mechanic-button"
                icon={<Plus size={15} color="#ffffff" />}
                onPress={openCreateModal}
              />
              <ActionButton
                label="Desativar selecionados"
                variant="danger"
                disabled={selectedCount === 0}
                testID="deactivate-selected-mechanics"
                loading={loading.deactivateMechanics}
                icon={<UserMinus size={15} color="#ffffff" />}
                onPress={() => {
                  setConfirmWord('');
                  setDeactivationResult(null);
                  setConfirmOpen(true);
                }}
              />
              <ActionButton
                label="Exportar CSV"
                variant="secondary"
                icon={<Download size={15} color="#344054" />}
                onPress={() => downloadCsv('mecanicos.csv', mechanicsToCsv(mechanics.rows))}
              />
            </View>
          }
        />
        <View style={styles.filters}>
          <SearchField testID="mechanics-search" value={filters.search} onChangeText={(search) => setFilters({ search, page: 1 })} onSubmitEditing={() => fetchMechanics({ page: 1 })} />
          <ActionButton testID="mechanics-search-submit" label="Aplicar" variant="secondary" onPress={() => fetchMechanics({ page: 1 })} />
        </View>
      </Panel>

      {deactivationResult ? (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>
            Desativação concluída: {deactivationResult.deactivatedCount} mecânico(s) desativado(s), {deactivationResult.ignoredCount} ignorado(s) e{' '}
            {deactivationResult.cancelledAppointmentCount} agendamento(s) de clientes cancelado(s).
          </Text>
        </View>
      ) : null}

      {loading.mechanics ? <LoadingState /> : null}
      {error ? <EmptyState title="Falha na solicitação" body={error} /> : null}

      {!loading.mechanics && rows.length === 0 ? (
        <EmptyState title="Sem mecânicos" body="Nenhum mecânico corresponde aos filtros atuais." />
      ) : (
        <Panel>
          <DataTable
            columns={[
              {
                key: 'select',
                label: (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: allVisibleSelected }}
                    onPress={toggleVisibleSelection}
                    style={styles.checkboxButton}
                    testID="select-all-mechanics"
                  >
                    {allVisibleSelected ? <CheckSquare size={18} color="#b42318" /> : <Square size={18} color="#667085" />}
                  </Pressable>
                ),
                width: 52,
              },
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

      <Modal transparent visible={confirmOpen} animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Desativar mecânicos selecionados</Text>
            <Text style={styles.modalBody}>
              Ao desativar, {selectedCount} mecânico{selectedCount === 1 ? '' : 's'} deixará{selectedCount === 1 ? '' : 'ão'} de poder receber agendamentos. Agendamentos pendentes (confirmados ou não finalizados) serão cancelados e esses clientes serão notificados. Trabalhos finalizados serão mantidos. Digite {DEACTIVATE_CONFIRMATION_WORD} para confirmar.
            </Text>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}
            <TextInput
              testID="deactivate-confirmation-input"
              value={confirmWord}
              onChangeText={(text) => setConfirmWord(text.slice(0, DEACTIVATE_CONFIRMATION_WORD.length))}
              placeholder={DEACTIVATE_CONFIRMATION_WORD}
              placeholderTextColor="#98a2b3"
              autoCapitalize="characters"
              style={styles.confirmInput}
              onSubmitEditing={() => {
                if (confirmationMatches && selectedCount > 0) {
                  void confirmDeactivation();
                }
              }}
            />
            <View style={styles.modalActions}>
              <ActionButton
                label="Cancelar"
                variant="secondary"
                disabled={loading.deactivateMechanics}
                onPress={() => {
                  setConfirmOpen(false);
                  setConfirmWord('');
                }}
              />
              <ActionButton
                label="Desativar"
                variant="danger"
                disabled={!confirmationMatches || selectedCount === 0}
                testID="deactivate-confirm"
                loading={loading.deactivateMechanics}
                onPress={confirmDeactivation}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={createOpen} animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 480 }]}>
            <Text style={styles.modalTitle}>Adicionar Novo Mecânico</Text>
            
            {validationError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{validationError}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nome Completo</Text>
              <TextInput
                testID="create-mechanic-name"
                value={name}
                onChangeText={setName}
                placeholder="Ex: João Silva"
                placeholderTextColor="#98a2b3"
                style={styles.input}
                onSubmitEditing={handleCreateMechanic}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Celular (com DDD)</Text>
                <TextInput
                  testID="create-mechanic-phone"
                  value={phone}
                  onChangeText={(text) => setPhone(formatPhone(text))}
                  placeholder="Ex: (11) 99999-9999"
                  placeholderTextColor="#98a2b3"
                  keyboardType="phone-pad"
                  maxLength={15}
                  style={styles.input}
                  onSubmitEditing={handleCreateMechanic}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  testID="create-mechanic-email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Ex: joao@exemplo.com"
                  placeholderTextColor="#98a2b3"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  onSubmitEditing={handleCreateMechanic}
                />
              </View>
            </View>
            <Text style={styles.helpText}>O e-mail será usado apenas para recuperação de senha.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Senha de Acesso</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  testID="create-mechanic-password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor="#98a2b3"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={[styles.input, { flex: 1, borderWidth: 0, minHeight: 40, paddingHorizontal: 0 }]}
                  onSubmitEditing={handleCreateMechanic}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Text style={styles.eyeButtonText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Especialidade</Text>
                <TextInput
                  testID="create-mechanic-specialty"
                  value={specialty}
                  onChangeText={setSpecialty}
                  placeholder="Ex: Motor, Suspensão"
                  placeholderTextColor="#98a2b3"
                  style={styles.input}
                  onSubmitEditing={handleCreateMechanic}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Credenciais (ex: CREA)</Text>
                <TextInput
                  testID="create-mechanic-credentials"
                  value={credentials}
                  onChangeText={setCredentials}
                  placeholder="Ex: CREA-123456"
                  placeholderTextColor="#98a2b3"
                  style={styles.input}
                  onSubmitEditing={handleCreateMechanic}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <ActionButton
                label="Cancelar"
                variant="secondary"
                disabled={loading.createMechanic}
                onPress={() => setCreateOpen(false)}
              />
              <ActionButton
                label="Confirmar Cadastro"
                variant="primary"
                testID="create-mechanic-submit"
                loading={loading.createMechanic}
                onPress={handleCreateMechanic}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
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
  checkboxButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
  confirmInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#101828',
    fontSize: 14,
    fontWeight: '800',
    outlineStyle: 'none' as never,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
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
  formGroup: {
    gap: 4,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#101828',
    fontSize: 14,
    fontWeight: '600',
    outlineStyle: 'none' as never,
  },
  helpText: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '500',
    marginTop: -8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  eyeButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  eyeButtonText: {
    color: '#027a48',
    fontSize: 12,
    fontWeight: '700',
  },
});
