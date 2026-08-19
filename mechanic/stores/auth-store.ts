import { create } from 'zustand';
import { isApiError } from '@main-mechanic/wire-client';
import { User, Mechanic, Role } from '@/types/models';
import * as authService from '@/services/auth-service';
import * as mechanicService from '@/services/mechanic-service';

interface AuthState {
  user: User | Mechanic | null;
  isLoading: boolean;
  isBootstrappingSession: boolean;
  isAuthActionLoading: boolean;
  isAuthenticated: boolean;
  role: Role | null;
  error: string | null;
  errorCode: string | null;

  loginByEmail: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: Pick<Mechanic, 'name' | 'specialty'>) => Promise<void>;
  setUser: (user: User | Mechanic | null) => void;
  setBootstrappingSession: (isBootstrappingSession: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const setLoadingState = (
    patch: Partial<Pick<AuthState, 'isBootstrappingSession' | 'isAuthActionLoading' | 'error' | 'errorCode'>>,
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
    errorCode: null,

    loginByEmail: async (email, password) => {
      setLoadingState({ isAuthActionLoading: true, error: null, errorCode: null });
      try {
        const user = await authService.login(email, password);
        if (user) {
          set({ user, isAuthenticated: true, role: user.role, error: null, errorCode: null });
          return true;
        }
      } catch (e) {
        set({
          error: e instanceof Error ? e.message : 'Login failed',
          errorCode: isApiError(e) ? e.code ?? null : null,
        });
      } finally {
        setLoadingState({ isAuthActionLoading: false });
      }

      return false;
    },

    logout: async () => {
      setLoadingState({ isAuthActionLoading: true, error: null, errorCode: null });
      set({ user: null, isAuthenticated: false, role: null, error: null, errorCode: null });
      try {
        await authService.logout();
      } catch {
      } finally {
        setLoadingState({ isAuthActionLoading: false });
      }
    },

    setUser: (user) => {
      set((state) => ({
        user,
        isAuthenticated: !!user,
        role: user?.role || null,
        isBootstrappingSession: false,
        isLoading: state.isAuthActionLoading,
        error: null,
        errorCode: null,
      }));
    },

    setBootstrappingSession: (isBootstrappingSession) => {
      setLoadingState({ isBootstrappingSession });
    },

    updateProfile: async (data) => {
      const { user } = get();
      if (!user) return;

      setLoadingState({ isAuthActionLoading: true, error: null, errorCode: null });
      try {
        const updatedUser = await mechanicService.updateMyProfile(data);
        set({ user: updatedUser, role: updatedUser.role, error: null, errorCode: null });
      } finally {
        setLoadingState({ isAuthActionLoading: false });
      }
    },
  };
});
