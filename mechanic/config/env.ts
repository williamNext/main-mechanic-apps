type ClientEnv = {
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
};

export const env: ClientEnv = {
  // Expo inlines only static dot-notation EXPO_PUBLIC_* reads at build time.
  // Build scripts run env:check to fail early if values are missing.
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string,
};
