type ClientEnv = {
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
};

const ENV_ALIASES: Record<keyof ClientEnv, string[]> = {
  EXPO_PUBLIC_SUPABASE_URL: ['SUPABASE_URL'],
  EXPO_PUBLIC_SUPABASE_ANON_KEY: ['SUPABASE_ANON_KEY'],
};

function readRequiredEnv(name: keyof ClientEnv): string {
  const candidates = [name, ...ENV_ALIASES[name]];

  for (const candidate of candidates) {
    const value = process.env[candidate];
    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing required env var: ${name}. Also checked aliases: ${ENV_ALIASES[name].join(', ')}. Configure it in Netlify (Site configuration > Environment variables) or inject with Doppler (doppler run -- <command>).`
  );
}

export const env: ClientEnv = {
  EXPO_PUBLIC_SUPABASE_URL: readRequiredEnv('EXPO_PUBLIC_SUPABASE_URL'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: readRequiredEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
};
