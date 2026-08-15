type ClientEnv = {
  EXPO_PUBLIC_API_URL: string;
};

export const env: ClientEnv = {
  // Expo inlines only static dot-notation EXPO_PUBLIC_* reads at build time.
  // Build scripts run env:check to fail early if values are missing.
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL as string,
};
