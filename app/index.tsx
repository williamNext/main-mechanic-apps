import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function Index() {
  const { isAuthenticated, isMechanic } = useAuth();

  if (!isAuthenticated || !isMechanic) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(mechanic)/agenda" />;
}
