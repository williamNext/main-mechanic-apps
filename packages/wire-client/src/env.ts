type ClientEnv = {
  EXPO_PUBLIC_API_URL: string;
};

export const env: ClientEnv = {
  // Expo inlines only static dot-notation EXPO_PUBLIC_* reads at build time.
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL as string,
};
