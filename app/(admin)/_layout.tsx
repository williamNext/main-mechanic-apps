import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function AdminLayout() {
  const { isAuthenticated, isAdmin, isBootstrappingSession } = useAuth();

  if (isBootstrappingSession) return null;

  if (!isAuthenticated || !isAdmin) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f7f8fa' } }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="approvals" />
      <Stack.Screen name="appointments" />
      <Stack.Screen name="finance" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="mechanics" />
    </Stack>
  );
}
