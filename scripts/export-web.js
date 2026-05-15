const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { spawnSync } = require('child_process');

for (const file of ['.env', '.env.local']) {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true, quiet: true });
  }
}

const required = {
  EXPO_PUBLIC_SUPABASE_URL: ['SUPABASE_URL'],
  EXPO_PUBLIC_SUPABASE_ANON_KEY: ['SUPABASE_ANON_KEY'],
};

for (const [name, aliases] of Object.entries(required)) {
  const value = [name, ...aliases]
    .map((candidate) => process.env[candidate])
    .find(Boolean);

  if (!value) {
    console.error(
      `Missing required env var: ${name}. Also checked aliases: ${aliases.join(', ')}. Set it in Vercel Environment Variables.`,
    );
    process.exit(1);
  }

  process.env[name] = value;
}

const result = spawnSync('npx expo export -p web', {
  shell: true,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
