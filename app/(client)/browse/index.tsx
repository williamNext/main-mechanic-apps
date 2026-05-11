import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MechanicCard } from '@/components/MechanicCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMechanicStore } from '@/stores/mechanic-store';
import { Colors, Spacing, BorderRadius, FontSize } from '@/constants/theme';

export default function BrowseMechanicsScreen() {
  const router = useRouter();
  const { mechanics, isLoading, fetchAll } = useMechanicStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = mechanics.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.specialty.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar mecânico ou especialidade..."
          placeholderTextColor={Colors.gray400}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={isLoading}
        onRefresh={fetchAll}
        renderItem={({ item }) => (
          <MechanicCard
            mechanic={item}
            onPress={() => router.push(`/(client)/browse/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="construct-outline"
            title="Nenhum mecânico encontrado"
            message="Tente outro termo de busca"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.xxl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray200,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.gray900,
  },
  list: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
  },
});
