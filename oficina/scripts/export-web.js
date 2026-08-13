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

const required = ['EXPO_PUBLIC_API_URL'];

for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing required env var: ${name}. Set it in Vercel Environment Variables.`);
    process.exit(1);
  }
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
