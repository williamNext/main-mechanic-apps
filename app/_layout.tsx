import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { supabase } from '@/services/api';
import { useAuthStore } from '@/stores/auth-store';
import * as authService from '@/services/auth-service';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const { setUser } = useAuthStore();

  useEffect(() => {
    // 1. Check initial session
    authService.getCurrentSessionUser().then((user) => {
      if (user) setUser(user);
    });

    // 2. Listen for auth changes (Guide step 6)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const user = await authService.getUserById(session.user.id);
          setUser(user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(mechanic)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(admin)" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
