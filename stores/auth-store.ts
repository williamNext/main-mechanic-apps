import { create } from 'zustand';
import { User, Mechanic, Role } from '@/types/models';
import * as authService from '@/services/auth-service';
import * as mechanicService from '@/services/mechanic-service';

const LOGIN_TIMEOUT_MS = 15000;

interface AuthState {
  user: User | Mechanic | null;
  isLoading: boolean;
  isBootstrappingSession: boolean;
  isAuthActionLoading: boolean;
  isAuthenticated: boolean;
  role: Role | null;
  error: string | null;

  loginByPhone: (phone: string, password: string) => Promise<boolean>;
  loginByEmail: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Mechanic>) => Promise<void>;
  setUser: (user: User | Mechanic | null) => void;
  setBootstrappingSession: (isBootstrappingSession: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
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

    loginByPhone: async (phone, password) => {
      setLoadingState({ isAuthActionLoading: true, error: null });
      try {
        const user = await authService.withTimeout(
          authService.loginByPhone(phone, password),
          LOGIN_TIMEOUT_MS,
          'Login request timed out',
        );
        if (user) {
          set({ user, isAuthenticated: true, role: user.role, error: null });
          return true;
        }
      } catch (e) {
// Error handled internally
        set({ error: e instanceof Error ? e.message : 'Login failed' });
      } finally {
        setLoadingState({ isAuthActionLoading: false });
      }

      return false;
    },

    loginByEmail: async (email, password) => {
      setLoadingState({ isAuthActionLoading: true, error: null });
      try {
        const user = await authService.withTimeout(
          authService.login(email, password),
          LOGIN_TIMEOUT_MS,
          'Login request timed out',
        );
        if (user) {
          set({ user, isAuthenticated: true, role: user.role, error: null });
          return true;
        }
      } catch (e) {
// Error handled internally
        set({ error: e instanceof Error ? e.message : 'Login failed' });
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
      } catch (e) {
// Error handled internally
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
      }));
    },

    setBootstrappingSession: (isBootstrappingSession) => {
      setLoadingState({ isBootstrappingSession });
    },

    updateProfile: async (data) => {
      const { user } = get();
      if (!user) return;

      setLoadingState({ isAuthActionLoading: true, error: null });
      try {
        await mechanicService.updateMechanicProfile(user.id, data);
        set({ user: { ...user, ...data } as User | Mechanic, error: null });
      } finally {
        setLoadingState({ isAuthActionLoading: false });
      }
    },
  };
});
