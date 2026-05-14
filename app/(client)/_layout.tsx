import { Tabs } from 'expo-router';
import { BottomNavBar } from '@/components/ui/BottomNavBar';
import { colors } from '@/constants/theme';

export default function ClientLayout() {
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
