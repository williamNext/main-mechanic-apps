import { Stack } from 'expo-router';

export default function BrowseLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[mechanicId]" />
    </Stack>
  );
}
