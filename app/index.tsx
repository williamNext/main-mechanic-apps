import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function Index() {
  const { isAuthenticated, isApprovedMechanic } = useAuth();

  if (!isAuthenticated || !isApprovedMechanic) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(mechanic)/agenda" />;
}
