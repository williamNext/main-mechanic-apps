import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppointmentCard } from '@/components/ui/AppointmentCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useAppointmentStore } from '@/stores/appointment-store';

export default function ClientBookingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { appointments, isLoading, fetchByClient } = useAppointmentStore();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (user?.id) {
      fetchByClient();
    }
  }, [user?.id, fetchByClient]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      if (mode === 'upcoming') {
        return appointment.status === 'confirmado';
      }
      return appointment.status === 'acabado' || appointment.status === 'cancelado' || appointment.status === 'nao_finalizado';
    });
  }, [appointments, mode]);

  const fabBottom = insets.bottom + spacing.md;
  const listBottomPadding = fabBottom + 56 + spacing.lg;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopAppBar showBackButton={false} onProfilePress={() => router.push('/(client)/profile')} />

      <View style={styles.pageTitleRow}>
        <Text style={styles.pageTitle}>Agendamentos</Text>
        <View style={styles.segmentWrap}>
          <SegmentButton label="Próximos" active={mode === 'upcoming'} onPress={() => setMode('upcoming')} />
          <SegmentButton label="Histórico" active={mode === 'past'} onPress={() => setMode('past')} />
        </View>
      </View>

      {isLoading && appointments.length === 0 ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => item.id}
          refreshing={isLoading}
          onRefresh={() => user?.id && fetchByClient()}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
          renderItem={({ item }) => (
            <AppointmentCard
              appointment={item}
              onPress={() => router.push(`/(client)/appointment/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="calendar-month" size={48} color={colors.outline} />
              <Text style={styles.emptyTitle}>Nenhum agendamento encontrado</Text>
              <Text style={styles.emptySubtitle}>Agende um serviço para começar</Text>
              <View style={styles.emptyCtaWrap}>
                <PrimaryButton
                  title="Novo Agendamento"
                  onPress={() => router.push('/(client)/browse')}
                  variant="secondary"
                />
              </View>
            </View>
          }
        />
      )}

      <Pressable
        onPress={() => router.push('/(client)/browse')}
        android_ripple={{ color: colors.surfaceContainerHigh }}
        style={({ pressed }) => [styles.fab, { bottom: fabBottom }, pressed && styles.pressed]}
      >
        <MaterialIcons name="add" size={26} color={colors.onPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.surfaceContainerHigh }}
      style={({ pressed }) => [styles.segmentButton, active && styles.segmentButtonActive, pressed && styles.pressed]}
    >
      <Text style={[styles.segmentLabel, active ? styles.segmentLabelActive : styles.segmentLabelInactive]}>{label}</Text>
    </Pressable>
  );
}

function SkeletonList() {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.skeletonList}>
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
  pageTitleRow: {
    paddingHorizontal: spacing.gutterMobile,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pageTitle: {
    ...typography.headlineLgMobile,
    color: colors.onSurface,
  },
  segmentWrap: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: spacing.xs,
    flexDirection: 'row',
  },
  segmentButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    ...shadow.light,
  },
  segmentLabel: {
    ...typography.labelSm,
  },
  segmentLabelActive: {
    color: colors.onPrimary,
  },
  segmentLabelInactive: {
    color: colors.onSurfaceVariant,
  },
  listContent: {
    paddingHorizontal: spacing.gutterMobile,
    paddingTop: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
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
  },
  emptyCtaWrap: {
    width: '100%',
    marginTop: spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: spacing.marginMobile,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.coral,
  },
  pressed: {
    opacity: 0.88,
  },
  skeletonList: {
    paddingHorizontal: spacing.gutterMobile,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  skeletonCard: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainer,
  },
});
