import { Redirect, Tabs } from 'expo-router';
import { BottomNavBar } from '@/components/ui/BottomNavBar';
import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

export default function MechanicLayout() {
  const { isAuthenticated, isBootstrappingSession, role } = useAuth();

  if (isBootstrappingSession) {
    return null;
  }

  if (!isAuthenticated || role !== 'mechanic') {
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
      <Tabs.Screen name="agenda" options={{ title: 'Agenda' }} />
      <Tabs.Screen name="availability" options={{ title: 'Horários' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
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
