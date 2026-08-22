import { useAuthStore } from '@/stores/auth-store';
import { Role } from '@main-mechanic/types';

export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    isBootstrappingSession,
    isAuthActionLoading,
    loginByEmail,
    logout,
    updateProfile,
  } =
    useAuthStore();

  const role: Role | null = user?.role ?? null;
  const isAdmin = role === 'admin';
  const isMechanic = role === 'mechanic';
  const isClient = role === 'client';

  return {
    user,
    role,
    isAuthenticated,
    isLoading,
    isBootstrappingSession,
    isAuthActionLoading,
    isAdmin,
    isMechanic,
    isClient,
    loginByEmail,
    logout,
    updateProfile,
  };
}
