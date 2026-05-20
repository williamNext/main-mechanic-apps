import { useAuthStore } from '@/stores/auth-store';
import { Mechanic, Role } from '@/types/models';

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
  const isApprovedMechanic = isMechanic && (user as Mechanic | null)?.isActive === true;
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
    isApprovedMechanic,
    isClient,
    loginByEmail,
    logout,
    updateProfile,
  };
}
