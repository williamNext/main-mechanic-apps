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
import { useAuthStore } from '@/stores/auth-store';
import * as authService from '@/services/auth-service';
import { useAppTheme } from '@main-mechanic/theme';

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

    const loadInitialSession = async () => {
      const requestId = ++profileRequestId.current;
      setBootstrappingSession(true);

      try {
        const user = await authService.getCurrentSessionUser();
        if (active && requestId === profileRequestId.current) setUser(user);
      } catch (error) {
        console.error('Initial session load error:', error);
        if (active && requestId === profileRequestId.current) setUser(null);
      }
    };

    void loadInitialSession();

    return () => {
      active = false;
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
        <Stack.Screen name="(client)" />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
