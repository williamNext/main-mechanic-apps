import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, typography } from '@main-mechanic/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';

const tabMeta: Record<string, { label: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  browse: { label: 'Explorar', icon: 'build' },
  bookings: { label: 'Reservas', icon: 'calendar-today' },
  notifications: { label: 'Avisos', icon: 'notifications' },
  profile: { label: 'Perfil', icon: 'person' },
};

export function BottomNavBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((store) => store.user);
  const unreadCount = useNotificationStore((store) => store.unreadCount);
  const fetchUnreadCount = useNotificationStore((store) => store.fetchUnreadCount);

  useEffect(() => {
    if (user?.id) void fetchUnreadCount(user.id);
  }, [fetchUnreadCount, user?.id]);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
      <View style={styles.container}>
        {state.routes
          .filter((route) => tabMeta[route.name])
          .map((route, index) => {
            const { options } = descriptors[route.key];
            const meta = tabMeta[route.name];
            const routeIndex = state.routes.findIndex((item) => item.key === route.key);
            const isFocused = state.index === routeIndex;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (event.defaultPrevented) {
                return;
              }

              if (route.name === 'browse') {
                navigation.navigate('browse', { screen: 'index' });
                return;
              }

              if (!isFocused) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                android_ripple={{ color: colors.surfaceContainerHigh }}
                style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              >
                <View style={[styles.tabInner, isFocused && styles.tabInnerActive]}>
                  <MaterialIcons
                    name={meta.icon}
                    size={22}
                    color={isFocused ? colors.secondary : colors.onSurfaceVariant}
                  />
                  {route.name === 'notifications' && unreadCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}>
                    {meta.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  container: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.base,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  pressed: {
    opacity: 0.8,
  },
  tabInner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
    gap: spacing.xs,
    position: 'relative',
  },
  tabInnerActive: {
    backgroundColor: colors.secondaryContainer,
    ...shadow.light,
  },
  tabLabel: {
    ...typography.labelSm,
  },
  tabLabelActive: {
    color: colors.secondary,
    fontFamily: typography.labelMd.fontFamily,
  },
  tabLabelInactive: {
    color: colors.onSurfaceVariant,
    opacity: 0.7,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 10,
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...typography.labelSm,
    color: colors.onPrimary,
  },
});
