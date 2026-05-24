import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function Index() {
  const { isAuthenticated, isAdmin, isBootstrappingSession } = useAuth();

  if (isBootstrappingSession) return null;

  if (!isAuthenticated || !isAdmin) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(admin)/dashboard" />;
}
