const required = {
  EXPO_PUBLIC_SUPABASE_URL: ['SUPABASE_URL'],
  EXPO_PUBLIC_SUPABASE_ANON_KEY: ['SUPABASE_ANON_KEY'],
};

const missing = Object.entries(required)
  .filter(([name, aliases]) => ![name, ...aliases].some((candidate) => process.env[candidate]))
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(
    `Missing required env vars: ${missing.join(', ')}. Set them in your CI provider (for Netlify: Site configuration > Environment variables) or run with Doppler.`
  );
  process.exit(1);
}

console.log('Env check passed.');
