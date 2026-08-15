import { create } from 'zustand';
import * as authService from '@/services/auth-service';
import { AdminUser, Role } from '@/types/models';

interface AuthState {
  user: AdminUser | null;
  isLoading: boolean;
  isBootstrappingSession: boolean;
  isAuthActionLoading: boolean;
  isAuthenticated: boolean;
  role: Role | null;
  error: string | null;

  loginByIdentifier: (identifier: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: AdminUser | null) => void;
  setBootstrappingSession: (isBootstrappingSession: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const setLoadingState = (
    patch: Partial<Pick<AuthState, 'isBootstrappingSession' | 'isAuthActionLoading' | 'error'>>,
  ) => {
    set((state) => {
      const isBootstrappingSession = patch.isBootstrappingSession ?? state.isBootstrappingSession;
      const isAuthActionLoading = patch.isAuthActionLoading ?? state.isAuthActionLoading;

      return {
        ...patch,
        isLoading: isBootstrappingSession || isAuthActionLoading,
      };
    });
  };

  return {
    user: null,
    isLoading: false,
    isBootstrappingSession: false,
    isAuthActionLoading: false,
    isAuthenticated: false,
    role: null,
    error: null,

    loginByIdentifier: async (identifier, password) => {
      setLoadingState({ isAuthActionLoading: true, error: null });
      try {
        const user = await authService.login(identifier, password);
        if (user) {
          set({ user, isAuthenticated: true, role: user.role, error: null });
          return true;
        }
      } catch (error) {
        console.error('loginByIdentifier failed:', error);
        set({ error: error instanceof Error ? error.message : 'Falha no login' });
      } finally {
        setLoadingState({ isAuthActionLoading: false });
      }

      return false;
    },

    logout: async () => {
      setLoadingState({ isAuthActionLoading: true, error: null });
      set({ user: null, isAuthenticated: false, role: null, error: null });
      try {
        await authService.logout();
      } finally {
        setLoadingState({ isAuthActionLoading: false });
      }
    },

    setUser: (user) => {
      set((state) => ({
        user,
        isAuthenticated: !!user,
        role: user?.role ?? null,
        isBootstrappingSession: false,
        isLoading: state.isAuthActionLoading,
        error: null,
      }));
    },

    setBootstrappingSession: (isBootstrappingSession) => {
      setLoadingState({ isBootstrappingSession });
    },
  };
});
