type ClientEnv = {
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
};

function readRequiredEnv(name: keyof ClientEnv): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. Use Doppler injection (doppler run -- <command>) or configure EAS/CI secrets.`
    );
  }
  return value;
}

export const env: ClientEnv = {
  EXPO_PUBLIC_SUPABASE_URL: readRequiredEnv('EXPO_PUBLIC_SUPABASE_URL'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: readRequiredEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
};

