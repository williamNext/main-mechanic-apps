import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function Index() {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated || role !== 'mechanic') {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(mechanic)/agenda" />;
}
