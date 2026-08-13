import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InputField } from '@/components/ui/InputField';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useMechanicStore } from '@/stores/mechanic-store';
import { PublicMechanic } from '@/types/models';
import { getInitials } from '@/utils/format';

export default function BrowseMechanicsScreen() {
  const router = useRouter();
  const { mechanics, isLoading, fetchAll } = useMechanicStore();
  const [search, setSearch] = React.useState('');

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(
    () =>
      mechanics.filter(
        (mechanic) =>
          mechanic.name.toLowerCase().includes(search.toLowerCase()) ||
          mechanic.specialty.toLowerCase().includes(search.toLowerCase()),
      ),
    [mechanics, search],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopAppBar showBackButton={false} onProfilePress={() => router.push('/(client)/profile')} />
      <View style={styles.container}>
        <InputField
          testID="browse-search"
          label="Buscar"
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou especialidade..."
          leftIcon={<MaterialIcons name="search" size={18} color={colors.outline} />}
        />

        {isLoading && mechanics.length === 0 ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            refreshing={isLoading}
            onRefresh={() => fetchAll({ force: true })}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <MechanicListCard
                mechanic={item}
                onPress={() => router.push(`/(client)/browse/${item.id}`)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="engineering" size={46} color={colors.outline} />
                <Text style={styles.emptyTitle}>Nenhum mecânico encontrado</Text>
                <Text style={styles.emptySubtitle}>Tente ajustar sua busca ou aguarde novos profissionais.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function MechanicListCard({ mechanic, onPress }: { mechanic: PublicMechanic; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 26,
      bounciness: 0,
    }).start();
  };

  return (
    <Animated.View style={[styles.cardAnimated, { transform: [{ scale }] }]}> 
      <Pressable
        testID={`mechanic-card-${mechanic.id}`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{ color: colors.surfaceContainerHigh }}
        style={({ pressed }) => [styles.mechanicCard, pressed && styles.pressed]}
      >
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{getInitials(mechanic.name)}</Text>
        </View>
        <View style={styles.mechanicInfo}>
          <Text numberOfLines={1} style={styles.mechanicName}>{mechanic.name}</Text>
          <Text style={styles.specialty}>{mechanic.specialty}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={colors.outlineVariant} />
      </Pressable>
    </Animated.View>
  );
}

function SkeletonList() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.skeletonWrap}>
      {[1, 2, 3].map((item) => (
        <Animated.View key={item} style={[styles.skeletonCard, { opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.gutterMobile,
    paddingTop: spacing.sm,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  cardAnimated: {
    marginBottom: spacing.xs,
  },
  mechanicCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.light,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.surfaceContainerHigh,
    backgroundColor: colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  mechanicInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  mechanicName: {
    ...typography.headlineMd,
    color: colors.primary,
  },
  specialty: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.9,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.base,
  },
  emptyTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 280,
  },
  skeletonWrap: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  skeletonCard: {
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainer,
  },
});
