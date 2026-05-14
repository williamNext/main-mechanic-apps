import { create } from 'zustand';
import { User, Mechanic, Role } from '@/types/models';
import * as authService from '@/services/auth-service';
import * as mechanicService from '@/services/mechanic-service';

const LOGIN_TIMEOUT_MS = 15000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

interface AuthState {
  user: User | Mechanic | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: Role | null;

  loginByPhone: (phone: string, password: string) => Promise<boolean>;
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

  loginByPhone: async (phone, password) => {
    set({ isLoading: true });
    try {
      const user = await withTimeout(
        authService.loginByPhone(phone, password),
        LOGIN_TIMEOUT_MS,
        'Login request timed out',
      );
      if (user) {
        set({ user, isAuthenticated: true, role: user.role });
        return true;
      }
    } catch (e) {
      console.error('Login error:', e);
    } finally {
      set({ isLoading: false });
    }

    return false;
  },

  loginByEmail: async (email, password) => {
    set({ isLoading: true });
    try {
      const user = await withTimeout(
        authService.login(email, password),
        LOGIN_TIMEOUT_MS,
        'Login request timed out',
      );
      if (user) {
        set({ user, isAuthenticated: true, role: user.role });
        return true;
      }
    } catch (e) {
      console.error('Login error:', e);
    } finally {
      set({ isLoading: false });
    }

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
