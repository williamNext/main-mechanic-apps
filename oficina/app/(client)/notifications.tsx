import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationStore } from '@/stores/notification-store';
import { AppNotification } from '@/types/models';

function formatCreatedAt(value: string) {
  return formatDistanceToNow(parseISO(value), { addSuffix: true, locale: ptBR });
}

export default function ClientNotificationsScreen() {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetch,
    markRead,
    markAllRead,
  } = useNotificationStore();

  useFocusEffect(
    useCallback(() => {
      if (user?.id) void fetch(user.id);
    }, [fetch, user?.id]),
  );

  const handleMarkAll = () => {
    if (user?.id) void markAllRead(user.id);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <TopAppBar showBackButton={false} title="Notificacoes" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Nao lidas</Text>
            <Text style={styles.summaryValue}>{unreadCount}</Text>
          </View>
          <PrimaryButton
            title="Marcar lidas"
            variant="outlined"
            onPress={handleMarkAll}
            disabled={!unreadCount || isLoading}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="notifications-none" size={28} color={colors.outline} />
            <Text style={styles.emptyTitle}>Sem notificacoes</Text>
            <Text style={styles.emptyText}>Confirmacoes e cancelamentos aparecem aqui.</Text>
          </View>
        ) : (
          notifications.map((item) => (
            <NotificationRow
              key={item.id}
              notification={item}
              onPress={() => {
                if (!item.readAt) void markRead(item.id);
              }}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const unread = !notification.readAt;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.surfaceContainerHigh }}
      style={({ pressed }) => [
        styles.notificationCard,
        unread && styles.notificationUnread,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, unread && styles.iconWrapUnread]}>
        <MaterialIcons
          name={notification.type === 'appointment_canceled' ? 'event-busy' : 'event-available'}
          size={20}
          color={unread ? colors.onPrimary : colors.secondary}
        />
      </View>
      <View style={styles.notificationText}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.notificationBody}>{notification.body}</Text>
        <Text style={styles.notificationTime}>{formatCreatedAt(notification.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.gutterMobile, paddingBottom: 120, gap: spacing.sm },
  summaryCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.sm,
    gap: spacing.sm,
    ...shadow.light,
  },
  summaryLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'uppercase' },
  summaryValue: { ...typography.headlineLgMobile, color: colors.primary },
  notificationCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    ...shadow.light,
  },
  notificationUnread: { borderColor: colors.secondary },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: { backgroundColor: colors.secondary },
  notificationText: { flex: 1, gap: spacing.xs },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  notificationTitle: { ...typography.headlineMd, color: colors.onSurface, flex: 1 },
  notificationBody: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  notificationTime: { ...typography.labelSm, color: colors.outline },
  unreadDot: { width: 9, height: 9, borderRadius: radius.full, backgroundColor: colors.secondary },
  emptyCard: {
    minHeight: 180,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  emptyTitle: { ...typography.headlineMd, color: colors.onSurface },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center' },
  errorText: { ...typography.labelSm, color: colors.error },
  pressed: { opacity: 0.85 },
});
