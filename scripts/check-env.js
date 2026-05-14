const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

for (const file of ['.env', '.env.local']) {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true, quiet: true });
  }
}

const required = {
  EXPO_PUBLIC_SUPABASE_URL: [],
  EXPO_PUBLIC_SUPABASE_ANON_KEY: [],
};

const missing = Object.entries(required)
  .filter(([name, aliases]) => ![name, ...aliases].some((candidate) => process.env[candidate]))
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(
    `Missing required env vars: ${missing.join(', ')}. Set them in Vercel project Environment Variables and local .env/.env.local.`
  );
  process.exit(1);
}

console.log('Env check passed.');
