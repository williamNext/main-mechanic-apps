import { useAuthStore } from '@/stores/auth-store';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    isBootstrappingSession,
    isAuthActionLoading,
    loginByIdentifier,
    logout,
  } = useAuthStore();

  const role = user?.role ?? null;
  const isAdmin = role === 'admin';

  return {
    user,
    role,
    isAuthenticated,
    isLoading,
    isBootstrappingSession,
    isAuthActionLoading,
    isAdmin,
    loginByIdentifier,
    logout,
  };
}
