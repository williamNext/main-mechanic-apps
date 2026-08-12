import { Redirect, Tabs } from 'expo-router';
import { BottomNavBar } from '@/components/ui/BottomNavBar';
import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

export default function ClientLayout() {
  const { isAuthenticated, isBootstrappingSession } = useAuth();

  if (isBootstrappingSession) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <BottomNavBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Explorar',
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Reservas',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notificacoes',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
        }}
      />
      <Tabs.Screen
        name="booking-success"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="appointment/[id]"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
