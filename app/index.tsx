import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function Index() {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(client)/browse" />;
}
