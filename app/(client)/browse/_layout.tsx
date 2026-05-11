import { Stack } from 'expo-router';
import { Colors, FontWeight } from '@/constants/theme';

export default function BrowseLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: FontWeight.semibold },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mecânicos Disponíveis' }} />
      <Stack.Screen name="[mechanicId]" options={{ title: 'Agendar' }} />
    </Stack>
  );
}
