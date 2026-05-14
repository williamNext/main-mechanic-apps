const required = {
  EXPO_PUBLIC_SUPABASE_URL: ['SUPABASE_URL'],
  EXPO_PUBLIC_SUPABASE_ANON_KEY: ['SUPABASE_ANON_KEY'],
};

const missing = Object.entries(required)
  .filter(([name, aliases]) => ![name, ...aliases].some((candidate) => process.env[candidate]))
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(
    `Missing required env vars: ${missing.join(', ')}. Set them in Netlify (Site configuration > Environment variables) and local .env/.env.local.`
  );
  process.exit(1);
}

console.log('Env check passed.');
