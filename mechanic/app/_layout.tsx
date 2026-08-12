import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { supabase } from '@/services/api';
import { useAuthStore } from '@/stores/auth-store';
import * as authService from '@/services/auth-service';
import { useAppTheme } from '@/hooks/use-theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { setUser, setBootstrappingSession, isAuthenticated, isAuthActionLoading } = useAuthStore();
  const { colors, theme } = useAppTheme();
  const profileRequestId = useRef(0);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    let active = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const loadInitialSession = async () => {
      const requestId = ++profileRequestId.current;
      setBootstrappingSession(true);

      try {
        const user = await authService.getCurrentSessionUser();
        if (active && requestId === profileRequestId.current) setUser(user);
      } catch (error) {
        console.error('Erro ao carregar sessão inicial:', error);
        if (active && requestId === profileRequestId.current) setUser(null);
      }
    };

    const scheduleProfileLoad = (userId: string, source: string) => {
      const requestId = ++profileRequestId.current;

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`[auth] ${source} event received; profile load deferred`);
      }

      const timer = setTimeout(() => {
        void authService
          .getUserById(userId)
          .then((user) => {
            if (active && requestId === profileRequestId.current) setUser(user);
          })
          .catch((error) => {
            console.error('Erro ao carregar perfil após evento de autenticação:', error);
            if (active && requestId === profileRequestId.current) setUser(null);
          });
      }, 0);

      timers.push(timer);
    };

    void loadInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        scheduleProfileLoad(session.user.id, event);
      } else if (event === 'SIGNED_OUT') {
        profileRequestId.current += 1;
        setUser(null);
      }
    });

    return () => {
      active = false;
      timers.forEach(clearTimeout);
      subscription.unsubscribe();
    };
  }, [setBootstrappingSession, setUser]);

  useEffect(() => {
    if (isAuthActionLoading && !isAuthenticated) {
      // Invalidate pending profile loads while logout is in progress.
      profileRequestId.current += 1;
    }
  }, [isAuthActionLoading, isAuthenticated]);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(mechanic)" />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
