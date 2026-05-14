import { create } from 'zustand';
import { User, Mechanic, Role } from '@/types/models';
import * as authService from '@/services/auth-service';
import * as mechanicService from '@/services/mechanic-service';

interface AuthState {
  user: User | Mechanic | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: Role | null;

  loginByEmail: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Mechanic>) => Promise<void>;
  setUser: (user: User | Mechanic | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  role: null,

  loginByEmail: async (email, password) => {
    set({ isLoading: true });
    try {
      const user = await authService.login(email, password);
      if (user) {
        set({ user, isAuthenticated: true, role: user.role, isLoading: false });
        return true;
      }
    } catch (e) {
      console.error('Login error:', e);
    }
    set({ isLoading: false });
    return false;
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, isAuthenticated: false, role: null });
  },

  setUser: (user) => {
    set({ 
      user, 
      isAuthenticated: !!user, 
      role: user?.role || null,
      isLoading: false 
    });
  },

  updateProfile: async (data) => {
    const { user } = get();
    if (!user) return;

    set({ isLoading: true });
    try {
      await mechanicService.updateMechanicProfile(user.id, data);
      set({ user: { ...user, ...data } as any });
    } finally {
      set({ isLoading: false });
    }
  },
}));
