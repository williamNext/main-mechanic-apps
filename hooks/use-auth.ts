import { useAuthStore } from '@/stores/auth-store';
import { Role } from '@/types/models';

export function useAuth() {
  const { user, isAuthenticated, isLoading, loginByRole, loginByEmail, logout, updateProfile } =
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
    isAdmin,
    isMechanic,
    isClient,
    loginByRole,
    loginByEmail,
    logout,
    updateProfile,
  };
}
