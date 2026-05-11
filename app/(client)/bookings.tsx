import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppointmentCard } from '@/components/AppointmentCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/use-auth';
import { useAppointmentStore } from '@/stores/appointment-store';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

export default function ClientBookingsScreen() {
  const { user } = useAuth();
  const { appointments, isLoading, fetchByClient } = useAppointmentStore();

  useEffect(() => {
    if (user?.id) fetchByClient(user.id);
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={isLoading}
        onRefresh={() => user?.id && fetchByClient(user.id)}
        renderItem={({ item }) => (
          <AppointmentCard appointment={item} showMechanic />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="Nenhum agendamento"
            message="Busque um mecânico e faça sua reserva"
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
  list: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
});
